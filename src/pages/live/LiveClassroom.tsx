import { useEffect, useRef, useState } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import {
  ensureLiveRoom,
  joinLiveRoom,
  leaveLiveRoom,
  setLiveRoomStatus,
  subscribeToLiveRoomParticipants,
  clearLiveRoomStudentConnection,
  writeLiveRoomOffer,
  writeLiveRoomAnswer,
  addStudentIceCandidate,
  addTutorIceCandidate,
  subscribeToLiveRoomConnection,
  subscribeToStudentIceCandidates,
  subscribeToTutorIceCandidates,
} from '@/lib/liveRoom'
import { useLiveWebRTC } from '@/hooks/useLiveWebRTC'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { getLiveSession, hasActiveEnrolment } from '@/lib/liveSessions'
import { computeLiveSessionPhase } from '@/types/liveSession'
import type { LiveSession } from '@/types/liveSession'

// TEMPORARY ON-SCREEN DEBUG LOG.
// There's no way to attach a laptop/DevTools to debug this on the actual
// mobile devices being used to test the classroom, so this mirrors every
// console.log/warn/error into an in-memory ring buffer that renders
// directly on the page (see the "Debug log" panel below). This lets the
// exact same [liveWebRTC]/[LiveClassroom] lines that would show in
// DevTools be read (and screenshotted) straight off the phone. Patched
// once at module scope — not inside the component — so it's active
// before any of useLiveWebRTC's internal effects run, and so it keeps
// capturing across remounts (e.g. Retry connection). Remove this whole
// block (and the panel further down) once the real root cause is fixed
// and confirmed stable.
type DebugLogListener = (lines: string[]) => void
const DEBUG_LOG_MAX_LINES = 200
const debugLogLines: string[] = []
const debugLogListeners = new Set<DebugLogListener>()

function pushDebugLog(line: string) {
  const timestamp = new Date().toLocaleTimeString()
  debugLogLines.push(`${timestamp}  ${line}`)
  if (debugLogLines.length > DEBUG_LOG_MAX_LINES) {
    debugLogLines.splice(0, debugLogLines.length - DEBUG_LOG_MAX_LINES)
  }
  debugLogListeners.forEach((listener) => listener([...debugLogLines]))
}

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

let debugConsolePatched = false
function ensureDebugConsolePatched() {
  if (debugConsolePatched) return
  debugConsolePatched = true

  const originalLog = console.log.bind(console)
  const originalWarn = console.warn.bind(console)
  const originalError = console.error.bind(console)

  const relevant = (text: string) =>
    text.includes('[liveWebRTC]') || text.includes('[LiveClassroom]')

  console.log = (...args: unknown[]) => {
    originalLog(...args)
    const text = formatConsoleArgs(args)
    if (relevant(text)) pushDebugLog(text)
  }

  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    const text = formatConsoleArgs(args)
    if (relevant(text)) pushDebugLog(`WARN ${text}`)
  }

  console.error = (...args: unknown[]) => {
    originalError(...args)
    const text = formatConsoleArgs(args)
    if (relevant(text)) pushDebugLog(`ERROR ${text}`)
  }
}

ensureDebugConsolePatched()

function useDebugLog(): string[] {
  const [lines, setLines] = useState<string[]>(debugLogLines)

  useEffect(() => {
    const listener: DebugLogListener = (next) => setLines(next)
    debugLogListeners.add(listener)
    setLines([...debugLogLines])

    return () => {
      debugLogListeners.delete(listener)
    }
  }, [])

  return lines
}

type ViewState = 'loading' | 'ready' | 'not_found' | 'no_access' | 'error'

export default function LiveClassroom() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, loading: authLoading } = useAuth()
  const { role: userRole, loading: roleLoading } = useUserRole()
  const { isAdmin, loading: adminLoading } = useAdminAuth()
  const navigate = useNavigate()

  const [session, setSession] = useState<LiveSession | null>(null)
  const [state, setState] = useState<ViewState>('loading')
  const [now, setNow] = useState(() => new Date())
  const [participants, setParticipants] = useState<import('@/types/liveRoom').LiveRoomParticipant[]>([])
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  // Root-cause fix for the remote tile rendering but staying permanently
  // black. Mobile Chrome (and others) only allow *unmuted* autoplay when
  // it directly follows a user gesture — attaching srcObject in a React
  // effect doesn't count, so play() on an unmuted <video> was silently
  // rejected (the .catch(() => undefined) hid it). The remote stream was
  // arriving fine — ontrack fired, the tile rendered — the <video>
  // element itself just never started. Tracks which remote users still
  // need a manual tap to unmute, for the ones where even the muted-first
  // trick below doesn't get past the browser's autoplay gate.
  const [remotesNeedingUnmute, setRemotesNeedingUnmute] = useState<
    Record<string, boolean>
  >({})
  const debugLog = useDebugLog()
  const [showDebugLog, setShowDebugLog] = useState(false)

  // ROLE-AWARE EXIT DESTINATION — root-cause fix.
  // Every "leave the classroom" link on this page used to point at the
  // hardcoded student route ('/dashboard'), regardless of who was
  // signed in. A tutor exiting a live class was therefore always sent
  // to the Student dashboard ("Your learning"). userRole comes from the
  // same useUserRole() lookup already used below to decide the WebRTC
  // role, so this reuses existing role detection instead of adding a
  // new one. Computed above the early-return states (not_found /
  // no_access / error) so those exits are role-aware too, not just the
  // main "Leave classroom" buttons.
  const dashboardPath = isAdmin
    ? '/admin/dashboard'
    : userRole === 'tutor'
      ? '/tutor/dashboard'
      : '/dashboard'

  useEffect(() => {
    if (authLoading || roleLoading || adminLoading) return

    if (!user) {
      navigate('/login', {
        state: { redirectTo: `/live-classroom/${sessionId}` },
      })
      return
    }

    if (!sessionId) {
      setState('not_found')
      return
    }

    let cancelled = false

    ;(async () => {
      setState('loading')

      try {
        const found = await getLiveSession(sessionId)

        if (cancelled) return

        if (!found) {
          setState('not_found')
          return
        }

        if (found.status !== 'published') {
          setState('no_access')
          return
        }

        const isTutor = !isAdmin && userRole === 'tutor' && found.tutor_id === user.id
        const enrolled = isAdmin || isTutor
          ? true
          : await hasActiveEnrolment(user.id, found.course_id)

        if (cancelled) return

        if (!enrolled) {
          setState('no_access')
          return
        }

        setSession(found)
        setState('ready')
      } catch (err) {
        console.error('Failed to load live classroom:', err)

        if (!cancelled) {
          setState('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, user, authLoading, roleLoading, adminLoading, isAdmin, userRole, navigate])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!session || !sessionId || !user || roleLoading || adminLoading) return

    const isTutor = !isAdmin && userRole === 'tutor'
    const participantRole = isAdmin ? 'admin' : isTutor ? 'tutor' : 'student'

    void ensureLiveRoom(sessionId)
      .then(() => joinLiveRoom(sessionId, {
        userId: user.id,
        displayName: user.displayName ?? (isTutor ? session.tutor_name : isAdmin ? 'Admin' : 'Student'),
        role: participantRole,
      }))
      .then(() => {
        if (isTutor) {
          return setLiveRoomStatus(sessionId, 'live')
        }
      })
      .catch((error) => {
        console.error('[LiveClassroom] Failed to join room:', error)
      })

    const unsubscribe = subscribeToLiveRoomParticipants(
      sessionId,
      setParticipants,
      (error) => console.error('[LiveClassroom] Participant listener error:', error),
    )

    return () => {
      unsubscribe()
      void leaveLiveRoom(sessionId, user.id).catch((error) => {
        console.error('[LiveClassroom] Failed to leave room:', error)
      })
    }
  }, [session, sessionId, user, userRole, roleLoading, adminLoading, isAdmin])

  const isTutor = !isAdmin && userRole === 'tutor'

  const {
    localStream,
    remoteStreams,
    mediaState,
      mediaError,
    connectionError,
    retryConnection,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
  } = useLiveWebRTC({
    sessionId: sessionId ?? '',
    userId: user?.id ?? '',
    enabled: !isAdmin,
    tutorId: session?.tutor_id ?? '',
    isTutor,
    participants,
    clearStudentConnection: clearLiveRoomStudentConnection,
    writeOffer: writeLiveRoomOffer,
    writeAnswer: writeLiveRoomAnswer,
    addStudentIce: addStudentIceCandidate,
    addTutorIce: addTutorIceCandidate,
    subscribeConnection: subscribeToLiveRoomConnection,
    subscribeStudentIce: subscribeToStudentIceCandidates,
    subscribeTutorIce: subscribeToTutorIceCandidates,
  })

  useEffect(() => {
    const video = localVideoRef.current
    if (!video) return

    video.srcObject = localStream ?? null

    if (localStream) {
      void video.play().catch(() => undefined)
    }
  }, [localStream])

  useEffect(() => {
    remoteStreams.forEach(({ userId, stream }) => {
      const video = remoteVideoRefs.current[userId]
      if (!video) return

      video.srcObject = stream

      // Start muted — muted autoplay is always allowed — then unmute
      // once playback has actually begun. Unmuting an element that's
      // already playing does not re-trigger the autoplay gate, so this
      // reliably gets audio flowing without needing a fresh tap.
      video.muted = true

      void video
        .play()
        .then(() => {
          video.muted = false
          setRemotesNeedingUnmute((current) => {
            if (!current[userId]) return current
            const next = { ...current }
            delete next[userId]
            return next
          })
        })
        .catch((error) => {
          console.error(
            '[LiveClassroom] Remote video failed to play:',
            { userId, error },
          )
          // Fall back to a manual "tap to unmute" affordance rather
          // than leaving the tile silently black/soundless forever.
          setRemotesNeedingUnmute((current) => ({
            ...current,
            [userId]: true,
          }))
        })
    })
  }, [remoteStreams])

  const unmuteRemote = (userId: string) => {
    const video = remoteVideoRefs.current[userId]
    if (!video) return

    video.muted = false
    void video
      .play()
      .then(() => {
        setRemotesNeedingUnmute((current) => {
          if (!current[userId]) return current
          const next = { ...current }
          delete next[userId]
          return next
        })
      })
      .catch((error) => {
        console.error(
          '[LiveClassroom] Manual unmute failed:',
          { userId, error },
        )
      })
  }

  if (state === 'loading' || authLoading || adminLoading || roleLoading) {
    return (
      <main className="min-h-screen bg-[#050b16] px-4 py-20 text-center text-slate-400">
        Loading classroom…
      </main>
    )
  }

  if (state === 'not_found') {
    return (
      <main className="min-h-screen bg-[#050b16] px-4 py-20 text-center text-white">
        <h1 className="text-2xl font-semibold">Classroom not found</h1>
        <p className="mt-3 text-sm text-slate-400">
          This live class does not exist or may have been removed.
        </p>
        <Link to={dashboardPath} className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </main>
    )
  }

  if (state === 'no_access') {
    return (
      <main className="min-h-screen bg-[#050b16] px-4 py-20 text-center text-white">
        <h1 className="text-2xl font-semibold">No access</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
          You do not have access to this live classroom. The class may not
          be published or you may not be actively enrolled in its course.
        </p>
        <Link to={dashboardPath} className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </main>
    )
  }

  if (state === 'error' || !session) {
    return (
      <main className="min-h-screen bg-[#050b16] px-4 py-20 text-center text-white">
        <h1 className="text-2xl font-semibold">Unable to connect</h1>
        <p className="mt-3 text-sm text-slate-400">
          Please check your internet connection and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary mt-6"
        >
          Retry
        </button>
      </main>
    )
  }

  const phase = computeLiveSessionPhase(session, now)

  return (
    <main className="min-h-screen bg-[#050b16] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 sm:px-5 lg:px-6">
        <header className="live-glass flex items-center justify-between rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              VATTAMS ACADEMIA
            </p>

            <h1 className="mt-1 truncate text-sm font-semibold sm:text-base">
              {session.course_name ?? 'Live Classroom'}
            </h1>

            <p className="mt-0.5 truncate text-xs text-slate-400">
              {session.title}
              {session.topic ? ` · ${session.topic}` : ''}
            </p>
          </div>

          <div className="live-pill shrink-0 text-xs font-semibold">
            <span className="live-pulse" />
            {phase === 'live' ? 'Live' : phase.replace('_', ' ')}
          </div>
        </header>

        <section className="grid flex-1 gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="live-glass relative min-h-[55vh] overflow-hidden rounded-3xl bg-black">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,.12),transparent_45%)]" />

              {remoteStreams.length > 0 ? (
                <div className="relative z-10 grid min-h-[55vh] grid-cols-1 gap-2 p-2 sm:grid-cols-2">
                  {remoteStreams.map(({ userId }) => {
                    const participant = participants.find((item) => item.user_id === userId)

                    return (
                      <div
                        key={userId}
                        className="relative min-h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#07111f]"
                      >
                        <video
                          ref={(element) => {
                            remoteVideoRefs.current[userId] = element

                            if (!element) return

                            const remote = remoteStreams.find((item) => item.userId === userId)
                            if (!remote) return

                            element.srcObject = remote.stream
                            element.muted = true
                            element.autoplay = true
                            element.playsInline = true

                            void element.play().catch((error) => {
                              console.error(
                                '[LiveClassroom] Remote video ref play failed:',
                                {
                                  userId,
                                  streamId: remote.stream.id,
                                  videoTracks: remote.stream.getVideoTracks().length,
                                  audioTracks: remote.stream.getAudioTracks().length,
                                  error,
                                },
                              )

                              setRemotesNeedingUnmute((current) => ({
                                ...current,
                                [userId]: true,
                              }))
                            })
                          }}
                          autoPlay
                          playsInline
                          className="h-full w-full object-cover"
                        />

                        <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                          {participant?.display_name ?? 'Participant'}
                        </div>

                        {remotesNeedingUnmute[userId] && (
                          <button
                            type="button"
                            onClick={() => unmuteRemote(userId)}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-white"
                          >
                            🔇 Tap to enable video/audio
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="relative z-10 flex min-h-[55vh] items-center justify-center px-6 text-center">
                  <div className="max-w-lg">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl shadow-2xl">
                      {session.tutor_name?.charAt(0).toUpperCase() ?? 'V'}
                    </div>

                    <h2 className="mt-5 text-xl font-semibold sm:text-2xl">
                      {session.tutor_name
                        ? `${session.tutor_name}'s classroom`
                        : "Your tutor's classroom"}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {phase === 'live'
                        ? 'Waiting for the media connection…'
                        : phase === 'starting_soon'
                          ? 'Your classroom is starting soon.'
                          : phase === 'upcoming'
                            ? 'This classroom has not started yet.'
                            : phase === 'ended'
                              ? 'This classroom has ended.'
                              : 'Classroom connection is being prepared.'}
                    </p>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-slate-400">
                      <div>Participants: {participants.length}</div>
                      <div className="mt-1">
                        WebRTC: {mediaState.connectionState}
                      </div>
                      <div className="mt-1">
                        Remote streams: {remoteStreams.length}
                      </div>
                    </div>

                    {/* Debug log moved below the video grid — see the
                        block right after </section> — so it stays
                        reachable once a remote tile is showing, not just
                        while still waiting for one. */}

                    {connectionError && (
                      <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-left text-xs leading-5 text-amber-200">
                        <p>{connectionError}</p>
                        <button
                          type="button"
                          onClick={() => retryConnection()}
                          className="btn-secondary mt-3 px-4 py-1.5 text-xs"
                        >
                          Retry connection
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {localStream && (
                <div className="absolute bottom-3 right-3 z-20 h-28 w-40 overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl sm:h-36 sm:w-52">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold backdrop-blur">
                    You
                  </span>
                </div>
              )}
            </div>

          <aside className="live-glass rounded-3xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Classroom
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              {session.title}
            </h2>

            {isAdmin && (
              <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/5 p-4">
                <p className="text-[11px] uppercase tracking-wider text-gold">Admin observer</p>
                <p className="mt-1 text-sm text-slate-300">You are monitoring this classroom without joining the WebRTC media connection.</p>
                <p className="mt-3 text-xs text-slate-500">Participants: {participants.length}</p>
                <div className="mt-2 space-y-1">
                  {participants.map((participant) => (
                    <p key={participant.user_id} className="text-xs text-slate-300">
                      {participant.display_name ?? 'Participant'} · {participant.role}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {session.description && (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {session.description}
              </p>
            )}

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  Tutor
                </p>
                <p className="mt-1 text-sm font-medium">
                  {session.tutor_name ?? 'Your tutor'}
                </p>
              </div>

              {session.topic && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Topic
                  </p>
                  <p className="mt-1 text-sm font-medium">{session.topic}</p>
                </div>
              )}

              {session.materials.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Materials
                  </p>

                  <div className="mt-2 space-y-2">
                    {session.materials.map((material, index) => (
                      <a
                        key={`${material.url}-${index}`}
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        {material.name || material.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              to={dashboardPath}
              className="btn-secondary mt-4 flex w-full justify-center"
            >
              Leave classroom
            </Link>
          </aside>
        </section>

          {/* TEMPORARY: on-screen debug log, see comment at top of file.
              Rendered here (outside the remoteStreams-empty/non-empty
              branches above) so it's reachable in every state, including
              once a remote tile is already showing — which is exactly
              the state needed to diagnose a stuck "tap to enable" tile.
              Remove this whole block once the root cause is confirmed
              fixed. */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowDebugLog((current) => !current)}
              className="btn-secondary w-full px-4 py-1.5 text-xs"
            >
              {showDebugLog ? 'Hide debug log' : 'Show debug log'}
            </button>

            {showDebugLog && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 text-left">
                {debugLog.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No log lines captured yet.
                  </p>
                ) : (
                  debugLog.map((line, index) => (
                    <p
                      key={index}
                      className="mb-1 whitespace-pre-wrap break-all font-mono text-[10px] leading-4 text-slate-300"
                    >
                      {line}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>

          {mediaError && (
            <div className="mb-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-xs leading-5 text-amber-200">
              {mediaError}
            </div>
          )}
        <footer className="live-glass flex flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-3">
          {isAdmin ? (
            <p className="text-sm font-semibold text-gold-bright">Admin observer mode — media controls are disabled.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void toggleMicrophone()}
                className="btn-secondary min-w-24"
                disabled={!localStream}
              >
                {mediaState.microphoneEnabled ? '🎙 Mic' : '🔇 Mic'}
              </button>

              <button
                type="button"
                onClick={() => void toggleCamera()}
                className="btn-secondary min-w-24"
                disabled={!localStream}
              >
                {mediaState.cameraEnabled ? '◉ Camera' : '◌ Camera'}
              </button>

              <button
                type="button"
                onClick={() => void toggleScreenShare()}
                className="btn-secondary min-w-24"
                disabled={!localStream}
              >
                {mediaState.screenSharing ? '▣ Stop Share' : '▣ Share'}
              </button>
            </>
          )}

          <Link
            to={dashboardPath}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
          >
            Leave
          </Link>
        </footer>
      </div>
    </main>
  )
}
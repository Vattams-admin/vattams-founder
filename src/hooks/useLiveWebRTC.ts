import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveRoomParticipant } from '@/types/liveRoom'

// STUN alone cannot traverse carrier-grade NAT, which is what most
// Android phones sit behind on mobile data — without a TURN relay,
// ICE negotiation completes but no media ever flows, and the UI hangs
// on "Waiting for the media connection…" indefinitely.
//
// These are the Open Relay Project's free, public TURN servers
// (https://www.metered.ca/tools/openrelay/) — no signup required.
// They're shared/rate-limited, so they're fine to unblock connectivity
// now, but for production reliability get a private TURN server (e.g.
// a Metered.ca or Twilio account, or self-hosted coturn) and swap
// the credentials below.
const waitForIceGatheringComplete = (
  peer: RTCPeerConnection,
  timeoutMs = 8000,
): Promise<void> => {
  if (peer.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      peer.removeEventListener(
        'icegatheringstatechange',
        handleStateChange,
      )
      clearTimeout(timeout)
      resolve()
    }

    const handleStateChange = () => {
      if (peer.iceGatheringState === 'complete') {
        finish()
      }
    }

    const timeout = window.setTimeout(finish, timeoutMs)

    peer.addEventListener(
      'icegatheringstatechange',
      handleStateChange,
    )
  })
}

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80',
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
}

export interface LiveWebRTCMediaState {
  microphoneEnabled: boolean
  cameraEnabled: boolean
  screenSharing: boolean
  connectionState: RTCPeerConnectionState | 'idle'
}

export interface LiveWebRTCRemoteStream {
  userId: string
  stream: MediaStream
}

interface UseLiveWebRTCOptions {
  sessionId: string
  userId: string
  tutorId: string
  isTutor: boolean
  enabled?: boolean
  participants: LiveRoomParticipant[]
  clearStudentConnection: (sessionId: string, studentId: string) => Promise<void>
  writeOffer: (
    sessionId: string,
    studentId: string,
    tutorId: string,
    offer: string,
  ) => Promise<void>
  writeAnswer: (
    sessionId: string,
    studentId: string,
    tutorId: string,
    answer: string,
  ) => Promise<void>
  addStudentIce: (
    sessionId: string,
    studentId: string,
    candidate: {
      fromUserId: string
      toUserId: string
      candidate: string
      sdpMid: string | null
      sdpMLineIndex: number | null
    },
  ) => Promise<void>
  addTutorIce: (
    sessionId: string,
    studentId: string,
    candidate: {
      fromUserId: string
      toUserId: string
      candidate: string
      sdpMid: string | null
      sdpMLineIndex: number | null
    },
  ) => Promise<void>
  subscribeConnection: (
    sessionId: string,
    studentId: string,
    onChange: (connection: {
      student_id: string
      tutor_id: string
      offer: string | null
      answer: string | null
      updated_at: string
    } | null) => void,
    onError?: (error: unknown) => void
  ) => () => void
  subscribeStudentIce: (
    sessionId: string,
    studentId: string,
    onCandidate: (candidate: {
      from_user_id: string
      to_user_id: string
      candidate: string
      sdp_mid: string | null
      sdp_m_line_index: number | null
      created_at: string
    }) => void,
    onError?: (error: unknown) => void
  ) => () => void
  subscribeTutorIce: (
    sessionId: string,
    studentId: string,
    onCandidate: (candidate: {
      from_user_id: string
      to_user_id: string
      candidate: string
      sdp_mid: string | null
      sdp_m_line_index: number | null
      created_at: string
    }) => void,
    onError?: (error: unknown) => void
  ) => () => void
}

export function useLiveWebRTC({
  sessionId,
  userId,
  tutorId,
  isTutor,
  enabled = true,
  participants,
  clearStudentConnection,
  writeOffer,
  writeAnswer,
  addStudentIce,
  addTutorIce,
  subscribeConnection,
  subscribeStudentIce,
  subscribeTutorIce,
}: UseLiveWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<LiveWebRTCRemoteStream[]>([])
  const [mediaState, setMediaState] = useState<LiveWebRTCMediaState>({
    microphoneEnabled: true,
    cameraEnabled: true,
    screenSharing: false,
    connectionState: 'idle',
  })
  const [mediaError, setMediaError] = useState<string | null>(null)

  // Root-cause fix for the classroom hanging on "Waiting for the media
  // connection…" / WebRTC: idle forever with zero feedback. Two distinct
  // situations produced that silent hang:
  //  1) `tutorId` (from session.tutor_id) is missing/blank — the
  //     signalling effect below has always required it and no-ops
  //     otherwise; that's correct, but it used to do so *silently*, so a
  //     session with incomplete tutor assignment looked identical to a
  //     healthy one that just hadn't connected yet.
  //  2) `tutorId` is present but negotiation (ICE/TURN, or the tutor
  //     simply hasn't joined yet) never completes — previously there was
  //     no timeout and no way to retry without leaving and re-entering
  //     the page.
  // `connectionError` surfaces both cases with an actionable message;
  // `retryConnection` lets the signalling effect below be re-run
  // on demand (e.g. after the tutor has joined, or a flaky network
  // recovers) without a full page reload.
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  // Auto-recovery for transient failures (flaky TURN relay, brief network
  // blips, Wi-Fi<->LTE handover). Previously a 'failed'/'closed' state just
  // tore the peer down and left the user staring at "Still trying to
  // connect" until they noticed and tapped Retry — capped auto-retries
  // give the connection a few unattended chances to recover first.
  const autoRetryAttemptsRef = useRef(0)
  const autoRetryTimerRef = useRef<number | null>(null)
  const MAX_AUTO_RETRIES = 3

  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const remoteStreamsRef = useRef(new Map<string, MediaStream>())
  const pendingCandidatesRef = useRef(
    new Map<string, RTCIceCandidateInit[]>(),
  )
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Guards against the signalling effect re-running (e.g. when the
  // `participants` list updates) while a negotiation for a given remote
  // peer is already in flight. Without this, two concurrent
  // createOffer()/setLocalDescription() (or createAnswer()/
  // setLocalDescription()) calls can race on the same RTCPeerConnection.
  const negotiatingRef = useRef(new Set<string>())

  const updateRemoteStream = useCallback(
    (remoteUserId: string, stream: MediaStream) => {
      remoteStreamsRef.current.set(remoteUserId, stream)

      setRemoteStreams(
        Array.from(remoteStreamsRef.current.entries()).map(
          ([userId, remoteStream]) => ({
            userId,
            stream: remoteStream,
          }),
        ),
      )
    },
    [],
  )

  const removePeer = useCallback((remoteUserId: string) => {
    const peer = peersRef.current.get(remoteUserId)
    peer?.close()
    peersRef.current.delete(remoteUserId)
    pendingCandidatesRef.current.delete(remoteUserId)
    remoteStreamsRef.current.delete(remoteUserId)

    setRemoteStreams(
      Array.from(remoteStreamsRef.current.entries()).map(
        ([userId, remoteStream]) => ({
          userId,
          stream: remoteStream,
        }),
      ),
    )
  }, [])

  // Manual escape hatch for "connection stalled and nothing is happening"
  // (see the timeout watchdog effect below) — closes any existing/stuck
  // peer connection(s) and bumps retryToken, which is in the signalling
  // effect's dependency array, forcing a full fresh offer/answer cycle
  // without requiring the admin/tutor/student to leave and re-enter the
  // classroom page.
  const retryConnection = useCallback(() => {
    peersRef.current.forEach((_peer, remoteUserId) => removePeer(remoteUserId))
    setConnectionError(null)
    setMediaState((current) => ({ ...current, connectionState: 'idle' }))
    setRetryToken((current) => current + 1)
  }, [removePeer])

  // A manual tap on "Retry connection" means the user is actively trying
  // again — give it the full auto-retry budget rather than one already
  // partly (or fully) spent by earlier automatic attempts.
  const retryConnectionManually = useCallback(() => {
    autoRetryAttemptsRef.current = 0
    retryConnection()
  }, [retryConnection])

  const createPeer = useCallback(
    (remoteUserId: string) => {
      const existing = peersRef.current.get(remoteUserId)
      if (existing) return existing

      console.log('[liveWebRTC] Creating peer connection', {
        role: isTutor ? 'tutor' : 'student',
        remoteUserId,
      })

      const peer = new RTCPeerConnection(RTC_CONFIGURATION)

      setMediaState((current) => ({
        ...current,
        connectionState: 'new',
      }))

      console.log('[liveWebRTC] Peer created successfully', {
        role: isTutor ? 'tutor' : 'student',
        remoteUserId,
        localStreamExists: Boolean(localStreamRef.current),
        localAudioTracks:
          localStreamRef.current?.getAudioTracks().length ?? 0,
        localVideoTracks:
          localStreamRef.current?.getVideoTracks().length ?? 0,
      })

      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream)
        })
      }

      peer.ontrack = (event) => {
        let remoteStream = remoteStreamsRef.current.get(remoteUserId)

        if (!remoteStream) {
          remoteStream = new MediaStream()
          remoteStreamsRef.current.set(remoteUserId, remoteStream)
        }

        const existingTrack = remoteStream
          .getTracks()
          .find((track) => track.id === event.track.id)

        if (!existingTrack) {
          remoteStream.addTrack(event.track)
        }

        console.log('[liveWebRTC] Remote track received', {
          remoteUserId,
          trackKind: event.track.kind,
          trackId: event.track.id,
          trackState: event.track.readyState,
          audioTracks: remoteStream.getAudioTracks().length,
          videoTracks: remoteStream.getVideoTracks().length,
        })

        updateRemoteStream(remoteUserId, remoteStream)
      }

      peer.onconnectionstatechange = () => {
        console.log('[liveWebRTC] connectionState changed', {
          remoteUserId,
          connectionState: peer.connectionState,
        })

        if (peer.connectionState === 'connected') {
          // A real recovery, not just the initial handshake — reset the
          // counter so a later, unrelated blip gets its own fresh budget
          // of auto-retries instead of inheriting an exhausted one.
          autoRetryAttemptsRef.current = 0
        }

        if (
          peer.connectionState === 'failed' ||
          peer.connectionState === 'closed'
        ) {
          removePeer(remoteUserId)

          if (autoRetryAttemptsRef.current < MAX_AUTO_RETRIES) {
            autoRetryAttemptsRef.current += 1
            const attempt = autoRetryAttemptsRef.current

            console.log(
              '[liveWebRTC] Connection dropped — auto-retrying',
              { remoteUserId, attempt, maxAttempts: MAX_AUTO_RETRIES },
            )

            if (autoRetryTimerRef.current) {
              window.clearTimeout(autoRetryTimerRef.current)
            }

            // Backoff (1.5s, 3s, 4.5s) instead of hammering the TURN
            // server immediately, in case the drop was load-related.
            autoRetryTimerRef.current = window.setTimeout(() => {
              retryConnection()
            }, attempt * 1500)
          } else {
            console.log(
              '[liveWebRTC] Connection dropped — auto-retry budget exhausted, waiting for manual retry',
              { remoteUserId },
            )
          }
        }

        setMediaState((current) => ({
          ...current,
          connectionState: peer.connectionState,
        }))
      }

      peer.oniceconnectionstatechange = () => {
        console.log('[liveWebRTC] iceConnectionState changed', {
          remoteUserId,
          iceConnectionState: peer.iceConnectionState,
        })
      }

      peer.onsignalingstatechange = () => {
        console.log('[liveWebRTC] signalingState changed', {
          remoteUserId,
          signalingState: peer.signalingState,
        })
      }

      peer.onicecandidate = async (event) => {
        if (!event.candidate) return

        console.log('[liveWebRTC] ICE candidate created', {
          role: isTutor ? 'tutor' : 'student',
          remoteUserId,
        })

        const candidate = {
          fromUserId: userId,
          toUserId: remoteUserId,
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        }

        if (isTutor) {
          await addTutorIce(sessionId, remoteUserId, candidate)
        } else {
          await addStudentIce(sessionId, userId, candidate)
        }
      }

      peersRef.current.set(remoteUserId, peer)
      return peer
    },
    [
      addStudentIce,
      addTutorIce,
      isTutor,
      removePeer,
      retryConnection,
      sessionId,
      updateRemoteStream,
      userId,
    ],
  )

  const addPendingCandidates = useCallback(
    async (remoteUserId: string, peer: RTCPeerConnection) => {
      const pending =
        pendingCandidatesRef.current.get(remoteUserId) ?? []

      for (const candidate of pending) {
        try {
          await peer.addIceCandidate(candidate)
        } catch (error) {
          console.error(
            '[liveWebRTC] Failed to add pending ICE candidate:',
            error,
          )
        }
      }

      pendingCandidatesRef.current.delete(remoteUserId)
    },
    [],
  )

  const handleRemoteCandidate = useCallback(
    async (
      remoteUserId: string,
      candidate: RTCIceCandidateInit,
    ) => {
      console.log('[liveWebRTC] ICE candidate received', {
        remoteUserId,
      })

      const peer = peersRef.current.get(remoteUserId)

      if (!peer || !peer.remoteDescription) {
        const pending =
          pendingCandidatesRef.current.get(remoteUserId) ?? []

        pending.push(candidate)
        pendingCandidatesRef.current.set(remoteUserId, pending)
        return
      }

      try {
        await peer.addIceCandidate(candidate)
      } catch (error) {
        console.error(
          '[liveWebRTC] Failed to add ICE candidate:',
          error,
        )
      }
    },
    [],
  )

  const startLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current

    try {
      setMediaError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })

      localStreamRef.current = stream
      setLocalStream(stream)

      setMediaState((current) => ({
        ...current,
        microphoneEnabled: stream
          .getAudioTracks()
          .some((track) => track.enabled),
        cameraEnabled: stream
          .getVideoTracks()
          .some((track) => track.enabled),
      }))

      return stream
    } catch (error) {
      console.error(
        '[liveWebRTC] Failed to access camera/microphone:',
        error,
      )

      setMediaError(
        'Camera or microphone access was blocked. Please allow permissions and try again.',
      )

      return null
    }
  }, [])

  const toggleMicrophone = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return

    const enabled = !mediaState.microphoneEnabled

    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })

    setMediaState((current) => ({
      ...current,
      microphoneEnabled: enabled,
    }))
  }, [mediaState.microphoneEnabled])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return

    const enabled = !mediaState.cameraEnabled

    stream.getVideoTracks().forEach((track) => {
      track.enabled = enabled
    })

    setMediaState((current) => ({
      ...current,
      cameraEnabled: enabled,
    }))
  }, [mediaState.cameraEnabled])

  const toggleScreenShare = useCallback(async () => {
    const peerEntries = Array.from(peersRef.current.entries())

    if (screenStreamRef.current) {
      screenStreamRef.current
        .getTracks()
        .forEach((track) => track.stop())

      screenStreamRef.current = null

      const cameraTrack =
        localStreamRef.current?.getVideoTracks()[0]

      if (cameraTrack) {
        for (const [, peer] of peerEntries) {
          const sender = peer
            .getSenders()
            .find(
              (item) => item.track?.kind === 'video',
            )

          if (sender) {
            await sender.replaceTrack(cameraTrack)
          }
        }
      }

      setMediaState((current) => ({
        ...current,
        screenSharing: false,
      }))

      return
    }

    try {
      const displayStream =
        await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        })

      const displayTrack =
        displayStream.getVideoTracks()[0]

      if (!displayTrack) return

      screenStreamRef.current = displayStream

      for (const [, peer] of peerEntries) {
        const sender = peer
          .getSenders()
          .find(
            (item) => item.track?.kind === 'video',
          )

        if (sender) {
          await sender.replaceTrack(displayTrack)
        }
      }

      displayTrack.onended = () => {
        void toggleScreenShare()
      }

      setMediaState((current) => ({
        ...current,
        screenSharing: true,
      }))
    } catch (error) {
      console.error(
        '[liveWebRTC] Screen share failed:',
        error,
      )
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    void startLocalMedia().then((stream) => {
      if (cancelled && stream) {
        stream
          .getTracks()
          .forEach((track) => track.stop())
      }
    })

    return () => {
      cancelled = true
    }
  }, [enabled, startLocalMedia])

  useEffect(() => {
    if (!enabled) return

    if (!sessionId || !userId || !tutorId) {
      // `enabled` is true (this is a real participant, not the admin
      // observer, who is deliberately excluded above), so a missing
      // tutorId here means the live session record itself has no
      // tutor_id (or an invalid one) — see src/lib/liveSessions.ts'
      // toLiveSession(), which normalises a missing/non-string
      // tutor_id to ''. Previously this just returned with no
      // indication anything was wrong, leaving connectionState frozen
      // at its initial 'idle' value forever.
      if (sessionId && userId && !tutorId) {
        console.error('[liveWebRTC] No tutor assigned to this session — cannot negotiate', {
          sessionId,
        })
        setConnectionError(
          "This class isn't linked to a tutor account, so it can't connect. Please contact support.",
        )
      }
      return
    }

    setConnectionError(null)

    const cleanups: Array<() => void> = []

    console.log('[liveWebRTC] Signalling effect started', {
      role: isTutor ? 'tutor' : 'student',
      sessionId,
      userId,
      tutorId,
      participantCount: participants.length,
      participantIds: participants.map(
        (participant) => participant.user_id,
      ),
    })

    if (isTutor) {
      const studentIds = participants
        .filter(
          (participant) =>
            participant.role === 'student',
        )
        .map(
          (participant) =>
            participant.user_id,
        )

      for (const studentId of studentIds) {
        const cleanupConnection =
          subscribeConnection(
            sessionId,
            studentId,
            (connection) => {
              if (!connection) return

              void (async () => {
                try {
                  await startLocalMedia()

                  const peer =
                    createPeer(studentId)

                  if (
                    connection.offer &&
                    connection.answer == null &&
                    peer.signalingState === 'stable' &&
                    !negotiatingRef.current.has(
                      studentId,
                    )
                  ) {
                    console.log(
                      '[liveWebRTC] Offer received',
                      {
                        studentId,
                        length:
                          connection.offer.length,
                      },
                    )

                    negotiatingRef.current.add(
                      studentId,
                    )

                    try {
                      await peer.setRemoteDescription(
                        JSON.parse(
                          connection.offer,
                        ) as RTCSessionDescriptionInit,
                      )

                      // Explicitly keep the tutor's local media
                      // bidirectional. This is important on mobile
                      // browsers where the answer can otherwise end up
                      // without a usable sending direction.
                      peer.getTransceivers().forEach((transceiver) => {
                        if (transceiver.sender.track) {
                          transceiver.direction = 'sendrecv'
                        }
                      })

                      await addPendingCandidates(
                        studentId,
                        peer,
                      )

                      const answer =
                        await peer.createAnswer()

                      console.log(
                        '[liveWebRTC] Answer created',
                        {
                          studentId,
                          type: answer.type,
                        },
                      )

                      await peer.setLocalDescription(
                        answer,
                      )

                      await waitForIceGatheringComplete(peer)

                      if (
                        peer.localDescription
                      ) {
                        await writeAnswer(
                          sessionId,
                          studentId,
                          tutorId,
                          JSON.stringify(
                            peer.localDescription,
                          ),
                        )

                        console.log(
                          '[liveWebRTC] Answer written',
                          { studentId },
                        )
                      }
                    } finally {
                      negotiatingRef.current.delete(
                        studentId,
                      )
                    }
                  }
                } catch (error) {
                  console.error(
                    '[liveWebRTC] Failed to process student offer:',
                    error,
                  )
                }
              })()
            },
          )

        const cleanupIce =
          subscribeStudentIce(
            sessionId,
            studentId,
            (candidate) => {
              if (
                candidate.from_user_id !==
                studentId
              ) {
                return
              }

              void handleRemoteCandidate(
                studentId,
                {
                  candidate:
                    candidate.candidate,
                  sdpMid:
                    candidate.sdp_mid,
                  sdpMLineIndex:
                    candidate.sdp_m_line_index,
                },
              )
            },
          )

        cleanups.push(
          cleanupConnection,
          cleanupIce,
        )
      }
    } else {
      const cleanupConnection =
        subscribeConnection(
          sessionId,
          userId,
          (connection) => {
            if (!connection?.answer) return

            const peer =
              peersRef.current.get(tutorId)

            if (
              !peer ||
              peer.signalingState === 'closed'
            ) {
              return
            }

            if (
              peer.signalingState !==
              'have-local-offer'
            ) {
              return
            }

            console.log(
              '[liveWebRTC] Answer received',
              {
                tutorId,
                length:
                  connection.answer.length,
              },
            )

            void (async () => {
              try {
                await peer.setRemoteDescription(
                  JSON.parse(
                    connection.answer!,
                  ) as RTCSessionDescriptionInit,
                )

                await addPendingCandidates(
                  tutorId,
                  peer,
                )
              } catch (error) {
                console.error(
                  '[liveWebRTC] Failed to process tutor answer:',
                  error,
                )
              }
            })()
          },
        )

      const cleanupIce =
        subscribeTutorIce(
          sessionId,
          userId,
          (candidate) => {
            if (
              candidate.from_user_id !==
              tutorId
            ) {
              return
            }

            void handleRemoteCandidate(
              tutorId,
              {
                candidate:
                  candidate.candidate,
                sdpMid:
                  candidate.sdp_mid,
                sdpMLineIndex:
                  candidate.sdp_m_line_index,
              },
            )
          },
        )

      cleanups.push(
        cleanupConnection,
        cleanupIce,
      )

      void (async () => {
        try {
          console.log('[liveWebRTC] Student negotiation starting', {
            userId,
            tutorId,
            participantCount: participants.length,
          })

          // A connection document is student-created on first join, but
          // the Firestore rules intentionally do not allow the student
          // to UPDATE that document. On a reload/retry, remove the old
          // signalling state first so the next offer is a CREATE again.
          // Do not repeat this cleanup when this effect merely re-runs
          // because the participants array changed while an active peer
          // already exists.
          const existingPeer = peersRef.current.get(tutorId)
          if (!existingPeer || existingPeer.signalingState === 'closed') {
            console.log('[liveWebRTC] Clearing stale student signalling state', {
              sessionId,
              studentId: userId,
              tutorId,
            })
            await clearStudentConnection(sessionId, userId)
            console.log('[liveWebRTC] Student signalling cleanup complete', {
              sessionId,
              studentId: userId,
              tutorId,
            })
          }

          const stream = await startLocalMedia()

          console.log('[liveWebRTC] Student local media ready', {
            hasStream: Boolean(stream),
            audioTracks: stream?.getAudioTracks().length ?? 0,
            videoTracks: stream?.getVideoTracks().length ?? 0,
          })

          const peer =
            createPeer(tutorId)

          console.log('[liveWebRTC] Student peer ready', {
            tutorId,
            signalingState: peer.signalingState,
            connectionState: peer.connectionState,
          })

          if (
            peer.signalingState !== 'stable' ||
            negotiatingRef.current.has(
              tutorId,
            )
          ) {
            return
          }

          negotiatingRef.current.add(
            tutorId,
          )

          try {
            console.log('[liveWebRTC] Creating student offer', {
              tutorId,
              signalingState: peer.signalingState,
              connectionState: peer.connectionState,
              senders: peer.getSenders().map((sender) => ({
                kind: sender.track?.kind ?? null,
                trackId: sender.track?.id ?? null,
              })),
            })

            const offer =
              await peer.createOffer()

            console.log(
              '[liveWebRTC] Offer created',
              {
                tutorId,
                type: offer.type,
              },
            )

            await peer.setLocalDescription(
              offer,
            )

            await waitForIceGatheringComplete(peer)

            if (peer.localDescription) {
              await writeOffer(
                sessionId,
                userId,
                tutorId,
                JSON.stringify(
                  peer.localDescription,
                ),
              )

              console.log(
                '[liveWebRTC] Offer written',
                { tutorId },
              )
            }
          } finally {
            negotiatingRef.current.delete(
              tutorId,
            )
          }
        } catch (error) {
          console.error(
            '[liveWebRTC] Failed to create student offer:',
            error,
          )
        }
      })()
    }

    return () => {
      cleanups.forEach(
        (cleanup) => cleanup(),
      )
    }
  }, [
    addPendingCandidates,
    createPeer,
    clearStudentConnection,
    enabled,
    handleRemoteCandidate,
    isTutor,
    participants,
    sessionId,
    subscribeConnection,
    subscribeStudentIce,
    subscribeTutorIce,
    tutorId,
    userId,
    writeAnswer,
    writeOffer,
    startLocalMedia,
    retryToken,
  ])

  // Connection timeout watchdog. tutorId being present means the
  // signalling effect above is actively trying to negotiate — but
  // "actively trying" can still stall indefinitely in practice (TURN
  // relay unreachable, the tutor hasn't opened the classroom yet, a
  // dropped Firestore listener, etc.), and previously there was no
  // timeout at all: the UI just said "Waiting for the media
  // connection…" forever with no error and no way to retry short of
  // leaving and re-entering the page. This does not touch the
  // signalling/ICE logic itself — it only starts a plain timer and, if
  // nothing has connected by the time it fires, turns the silent stall
  // into a visible, actionable message.
useEffect(() => {
  if (!enabled || !sessionId || !userId || !tutorId) return
  if (remoteStreams.length > 0) return
  if (mediaState.connectionState === 'connected') return

  const timeoutMs = 20000
  const timer = window.setTimeout(() => {
    setConnectionError((current) =>
      current ??
      "Still trying to connect — this is taking longer than expected. " +
        "Make sure your tutor has joined the class, then try again.",
    )
  }, timeoutMs)

  return () => window.clearTimeout(timer)
  // Re-armed by remoteStreams/connectionState changes (so it clears
  // once media actually flows) and by retryToken (so hitting Retry
  // gives the next attempt a fresh full timeout window).
}, [enabled, sessionId, userId, tutorId, remoteStreams.length, mediaState.connectionState, retryToken])
  useEffect(() => {
    if (!enabled || !sessionId || !userId || !tutorId) return
    if (remoteStreams.length > 0) return
    if (mediaState.connectionState === 'connected') return

    const timeoutMs = 20000
    const timer = window.setTimeout(() => {
      setConnectionError((current) =>
        current ??
        "Still trying to connect — this is taking longer than expected. " +
          "Make sure your tutor has joined the class, then try again.",
      )
    }, timeoutMs)

    return () => window.clearTimeout(timer)
    // Re-armed by remoteStreams/connectionState changes (so it clears
    // once media actually flows) and by retryToken (so hitting Retry
    // gives the next attempt a fresh full timeout window).
  }, [enabled, sessionId, userId, tutorId, remoteStreams.length, mediaState.connectionState, retryToken])

  useEffect(() => {
    const peers = peersRef.current
    const remoteStreams = remoteStreamsRef.current

    return () => {
      if (autoRetryTimerRef.current) {
        window.clearTimeout(autoRetryTimerRef.current)
      }

    peers.forEach(
      (peer) => peer.close(),
    )
      peers.clear()

      screenStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop())

      localStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop())

      screenStreamRef.current = null
      localStreamRef.current = null
      remoteStreams.clear()
    }
  }, [])

  return {
    localStream,
    remoteStreams,
    mediaState,
    mediaError,
    connectionError,
    retryConnection: retryConnectionManually,
    startLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
  }
}
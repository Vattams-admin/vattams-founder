import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveRoomParticipant } from '@/types/liveRoom'

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
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
  participants: LiveRoomParticipant[]
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
    onError?: (error: unknown) => void,
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
    onError?: (error: unknown) => void,
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
    onError?: (error: unknown) => void,
  ) => () => void
}

export function useLiveWebRTC({
  sessionId,
  userId,
  tutorId,
  isTutor,
  participants,
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
        ([userId, stream]) => ({
          userId,
          stream,
        }),
      ),
    )
  }, [])

  const createPeer = useCallback(
    (remoteUserId: string) => {
      const existing = peersRef.current.get(remoteUserId)
      if (existing) return existing

      console.log('[liveWebRTC] Creating peer connection', {
        role: isTutor ? 'tutor' : 'student',
        remoteUserId,
      })

      const peer = new RTCPeerConnection(RTC_CONFIGURATION)

      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream)
        })
      }

      peer.ontrack = (event) => {
        const streamFromPeer = event.streams[0] ?? remoteStreamsRef.current.get(remoteUserId) ?? new MediaStream()

        if (!event.streams[0]) {
          streamFromPeer.addTrack(event.track)
        }

        console.log('[liveWebRTC] Remote track received', {
          remoteUserId,
          trackKind: event.track.kind,
          trackState: event.track.readyState,
          streamTrackCount: streamFromPeer.getTracks().length,
        })

        updateRemoteStream(remoteUserId, streamFromPeer)
      }

      peer.onconnectionstatechange = () => {
        console.log('[liveWebRTC] connectionState changed', {
          remoteUserId,
          connectionState: peer.connectionState,
        })

        if (
          peer.connectionState === 'failed' ||
          peer.connectionState === 'closed'
        ) {
          removePeer(remoteUserId)
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
      sessionId,
      updateRemoteStream,
      userId,
    ],
  )

  const addPendingCandidates = useCallback(
    async (remoteUserId: string, peer: RTCPeerConnection) => {
      const pending = pendingCandidatesRef.current.get(remoteUserId) ?? []

      for (const candidate of pending) {
        try {
          await peer.addIceCandidate(candidate)
        } catch (error) {
          console.error('[liveWebRTC] Failed to add pending ICE candidate:', error)
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
      console.log('[liveWebRTC] ICE candidate received', { remoteUserId })

      const peer = peersRef.current.get(remoteUserId)

      if (!peer || !peer.remoteDescription) {
        const pending = pendingCandidatesRef.current.get(remoteUserId) ?? []
        pending.push(candidate)
        pendingCandidatesRef.current.set(remoteUserId, pending)
        return
      }

      try {
        await peer.addIceCandidate(candidate)
      } catch (error) {
        console.error('[liveWebRTC] Failed to add ICE candidate:', error)
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
        microphoneEnabled: stream.getAudioTracks().some((track) => track.enabled),
        cameraEnabled: stream.getVideoTracks().some((track) => track.enabled),
      }))

      return stream
    } catch (error) {
      console.error('[liveWebRTC] Failed to access camera/microphone:', error)
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
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null

      const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
      if (cameraTrack) {
        for (const [, peer] of peerEntries) {
          const sender = peer
            .getSenders()
            .find((item) => item.track?.kind === 'video')

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
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })

      const displayTrack = displayStream.getVideoTracks()[0]
      if (!displayTrack) return

      screenStreamRef.current = displayStream

      for (const [, peer] of peerEntries) {
        const sender = peer
          .getSenders()
          .find((item) => item.track?.kind === 'video')

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
      console.error('[liveWebRTC] Screen share failed:', error)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void startLocalMedia().then((stream) => {
      if (cancelled && stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    })

    return () => {
      cancelled = true
    }
  }, [startLocalMedia])

  useEffect(() => {
    if (!sessionId || !userId || !tutorId) {
      return
    }

    const cleanups: Array<() => void> = []

    if (isTutor) {
      const studentIds = participants
        .filter((participant) => participant.role === 'student')
        .map((participant) => participant.user_id)

        for (const studentId of studentIds) {
          const cleanupConnection = subscribeConnection(
            sessionId,
            studentId,
            (connection) => {
              if (!connection) return

              void (async () => {
                try {
                  await startLocalMedia()

                  const peer = createPeer(studentId)

                  if (
                    connection.offer &&
                    connection.answer == null &&
                    peer.signalingState === 'stable' &&
                    !negotiatingRef.current.has(studentId)
                  ) {
                    console.log('[liveWebRTC] Offer received', {
                      studentId,
                      length: connection.offer.length,
                    })

                    negotiatingRef.current.add(studentId)

                    try {
                      await peer.setRemoteDescription(
                        JSON.parse(connection.offer) as RTCSessionDescriptionInit,
                      )

                      await addPendingCandidates(studentId, peer)

                      const answer = await peer.createAnswer()
                      console.log('[liveWebRTC] Answer created', {
                        studentId,
                        type: answer.type,
                      })
                      await peer.setLocalDescription(answer)

                      if (peer.localDescription) {
                        await writeAnswer(
                          sessionId,
                          studentId,
                          tutorId,
                          JSON.stringify(peer.localDescription),
                        )
                        console.log('[liveWebRTC] Answer written', { studentId })
                      }
                    } finally {
                      negotiatingRef.current.delete(studentId)
                    }
                  }
                } catch (error) {
                  console.error('[liveWebRTC] Failed to process student offer:', error)
                }
              })()
            },
          )

        const cleanupIce = subscribeStudentIce(
          sessionId,
          studentId,
          (candidate) => {
            if (candidate.from_user_id !== studentId) return

            void handleRemoteCandidate(studentId, {
              candidate: candidate.candidate,
              sdpMid: candidate.sdp_mid,
              sdpMLineIndex: candidate.sdp_m_line_index,
            })
          },
        )

        cleanups.push(cleanupConnection, cleanupIce)
      }
    } else {
      const cleanupConnection = subscribeConnection(
        sessionId,
        userId,
        (connection) => {
          if (!connection?.answer) return

          const peer = peersRef.current.get(tutorId)
          if (!peer || peer.signalingState === 'closed') return

          if (peer.signalingState !== 'have-local-offer') return

          console.log('[liveWebRTC] Answer received', {
            tutorId,
            length: connection.answer.length,
          })

          void (async () => {
            try {
              await peer.setRemoteDescription(
                JSON.parse(connection.answer!) as RTCSessionDescriptionInit,
              )
              await addPendingCandidates(tutorId, peer)
            } catch (error) {
              console.error('[liveWebRTC] Failed to process tutor answer:', error)
            }
          })()
        },
      )

      const cleanupIce = subscribeTutorIce(
        sessionId,
        userId,
        (candidate) => {
          if (candidate.from_user_id !== tutorId) return

          void handleRemoteCandidate(tutorId, {
            candidate: candidate.candidate,
            sdpMid: candidate.sdp_mid,
            sdpMLineIndex: candidate.sdp_m_line_index,
          })
        },
      )

      cleanups.push(cleanupConnection, cleanupIce)


      void (async () => {
        try {
          await startLocalMedia()

          const peer = createPeer(tutorId)

          if (
            peer.signalingState !== 'stable' ||
            negotiatingRef.current.has(tutorId)
          ) {
            return
          }

          negotiatingRef.current.add(tutorId)

          try {
            const offer = await peer.createOffer()
            console.log('[liveWebRTC] Offer created', { tutorId, type: offer.type })
            await peer.setLocalDescription(offer)

            if (peer.localDescription) {
              await writeOffer(
                sessionId,
                userId,
                tutorId,
                JSON.stringify(peer.localDescription),
              )
              console.log('[liveWebRTC] Offer written', { tutorId })
            }
          } finally {
            negotiatingRef.current.delete(tutorId)
          }
        } catch (error) {
          console.error('[liveWebRTC] Failed to create student offer:', error)
        }
      })()
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [
    addPendingCandidates,
    createPeer,
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
  ])

  useEffect(() => {
    return () => {
      peersRef.current.forEach((peer) => peer.close())
      peersRef.current.clear()

      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current?.getTracks().forEach((track) => track.stop())

      screenStreamRef.current = null
      localStreamRef.current = null
      remoteStreamsRef.current.clear()
    }
  }, [])

  return {
    localStream,
    remoteStreams,
    mediaState,
    mediaError,
    startLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
  }
}
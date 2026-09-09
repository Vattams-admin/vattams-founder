import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type {
  LiveRoom,
  LiveRoomParticipant,
  LiveRoomParticipantRole,
  LiveRoomParticipantStatus,
} from '@/types/liveRoom'

const ROOMS = 'live_rooms'
const PARTICIPANTS = 'participants'
const CONNECTIONS = 'connections'
const STUDENT_ICE = 'student_ice'
const TUTOR_ICE = 'tutor_ice'

function roomRef(sessionId: string) {
  return doc(firestore, ROOMS, sessionId)
}

function participantRef(sessionId: string, userId: string) {
  return doc(collection(roomRef(sessionId), PARTICIPANTS), userId)
}

function connectionRef(sessionId: string, studentId: string) {
  return doc(collection(roomRef(sessionId), CONNECTIONS), studentId)
}

function studentIceCollection(sessionId: string, studentId: string) {
  return collection(connectionRef(sessionId, studentId), STUDENT_ICE)
}

function tutorIceCollection(sessionId: string, studentId: string) {
  return collection(connectionRef(sessionId, studentId), TUTOR_ICE)
}

export async function writeLiveRoomOffer(
  sessionId: string,
  studentId: string,
  tutorId: string,
  offer: string,
): Promise<void> {
  await setDoc(
    connectionRef(sessionId, studentId),
    {
      student_id: studentId,
      tutor_id: tutorId,
      offer,
      answer: null,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  )
}

export async function writeLiveRoomAnswer(
  sessionId: string,
  studentId: string,
  tutorId: string,
  answer: string,
): Promise<void> {
  await setDoc(
    connectionRef(sessionId, studentId),
    {
      student_id: studentId,
      tutor_id: tutorId,
      answer,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  )
}

export function subscribeToLiveRoomConnection(
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
): Unsubscribe {
  return onSnapshot(
    connectionRef(sessionId, studentId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null)
        return
      }

      const data = snapshot.data()

      onChange({
        student_id:
          typeof data.student_id === 'string' ? data.student_id : studentId,
        tutor_id: typeof data.tutor_id === 'string' ? data.tutor_id : '',
        offer: typeof data.offer === 'string' ? data.offer : null,
        answer: typeof data.answer === 'string' ? data.answer : null,
        updated_at:
          typeof data.updated_at === 'string'
            ? data.updated_at
            : new Date().toISOString(),
      })
    },
    (error) => {
      console.error('[liveRoom] Connection listener error:', error)
      onError?.(error)
    },
  )
}

export async function addStudentIceCandidate(
  sessionId: string,
  studentId: string,
  candidate: {
    fromUserId: string
    toUserId: string
    candidate: string
    sdpMid: string | null
    sdpMLineIndex: number | null
  },
): Promise<void> {
  await addDoc(studentIceCollection(sessionId, studentId), {
    from_user_id: candidate.fromUserId,
    to_user_id: candidate.toUserId,
    candidate: candidate.candidate,
    sdp_mid: candidate.sdpMid,
    sdp_m_line_index: candidate.sdpMLineIndex,
    created_at: new Date().toISOString(),
  })
}

export async function addTutorIceCandidate(
  sessionId: string,
  studentId: string,
  candidate: {
    fromUserId: string
    toUserId: string
    candidate: string
    sdpMid: string | null
    sdpMLineIndex: number | null
  },
): Promise<void> {
  await addDoc(tutorIceCollection(sessionId, studentId), {
    from_user_id: candidate.fromUserId,
    to_user_id: candidate.toUserId,
    candidate: candidate.candidate,
    sdp_mid: candidate.sdpMid,
    sdp_m_line_index: candidate.sdpMLineIndex,
    created_at: new Date().toISOString(),
  })
}

function subscribeToIceCollection(
  iceCollection: ReturnType<typeof collection>,
  onCandidate: (candidate: {
    from_user_id: string
    to_user_id: string
    candidate: string
    sdp_mid: string | null
    sdp_m_line_index: number | null
    created_at: string
  }) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    iceCollection,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return

        const data = change.doc.data()

        if (typeof data.candidate !== 'string') return

        onCandidate({
          from_user_id:
            typeof data.from_user_id === 'string' ? data.from_user_id : '',
          to_user_id:
            typeof data.to_user_id === 'string' ? data.to_user_id : '',
          candidate: data.candidate,
          sdp_mid: typeof data.sdp_mid === 'string' ? data.sdp_mid : null,
          sdp_m_line_index:
            typeof data.sdp_m_line_index === 'number'
              ? data.sdp_m_line_index
              : null,
          created_at:
            typeof data.created_at === 'string'
              ? data.created_at
              : new Date().toISOString(),
        })
      })
    },
    (error) => {
      console.error('[liveRoom] ICE listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeToStudentIceCandidates(
  sessionId: string,
  studentId: string,
  onCandidate: Parameters<typeof subscribeToIceCollection>[1],
  onError?: (error: unknown) => void,
): Unsubscribe {
  return subscribeToIceCollection(
    studentIceCollection(sessionId, studentId),
    onCandidate,
    onError,
  )
}

export function subscribeToTutorIceCandidates(
  sessionId: string,
  studentId: string,
  onCandidate: Parameters<typeof subscribeToIceCollection>[1],
  onError?: (error: unknown) => void,
): Unsubscribe {
  return subscribeToIceCollection(
    tutorIceCollection(sessionId, studentId),
    onCandidate,
    onError,
  )
}

function toParticipant(
  id: string,
  data: Record<string, unknown>,
): LiveRoomParticipant {
  return {
    id,
    session_id: typeof data.session_id === 'string' ? data.session_id : '',
    user_id: typeof data.user_id === 'string' ? data.user_id : id,
    display_name:
      typeof data.display_name === 'string' ? data.display_name : null,
    role: (data.role as LiveRoomParticipantRole) ?? 'student',
    status: (data.status as LiveRoomParticipantStatus) ?? 'connecting',
    audio_enabled: data.audio_enabled !== false,
    video_enabled: data.video_enabled !== false,
    screen_sharing: data.screen_sharing === true,
    joined_at:
      typeof data.joined_at === 'string' ? data.joined_at : new Date().toISOString(),
    last_seen_at:
      typeof data.last_seen_at === 'string'
        ? data.last_seen_at
        : new Date().toISOString(),
  }
}

function toRoom(sessionId: string, data: Record<string, unknown>): LiveRoom {
  return {
    session_id: sessionId,
    status: data.status === 'live' || data.status === 'ended' ? data.status : 'waiting',
    created_at:
      typeof data.created_at === 'string'
        ? data.created_at
        : new Date().toISOString(),
    updated_at:
      typeof data.updated_at === 'string'
        ? data.updated_at
        : new Date().toISOString(),
  }
}

export async function ensureLiveRoom(sessionId: string): Promise<void> {
  const ref = roomRef(sessionId)
  const existing = await getDoc(ref)

  if (existing.exists()) return

  const now = new Date().toISOString()

  await setDoc(ref, {
    session_id: sessionId,
    status: 'waiting',
    created_at: now,
    updated_at: now,
  })
}

export async function getLiveRoom(
  sessionId: string,
): Promise<LiveRoom | null> {
  const snap = await getDoc(roomRef(sessionId))

  if (!snap.exists()) return null

  return toRoom(sessionId, snap.data())
}

export async function setLiveRoomStatus(
  sessionId: string,
  status: LiveRoom['status'],
): Promise<void> {
  await setDoc(
    roomRef(sessionId),
    {
      session_id: sessionId,
      status,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  )
}

export async function joinLiveRoom(
  sessionId: string,
  participant: {
    userId: string
    displayName: string | null
    role: LiveRoomParticipantRole
  },
): Promise<void> {
  const now = new Date().toISOString()

  await setDoc(participantRef(sessionId, participant.userId), {
    session_id: sessionId,
    user_id: participant.userId,
    display_name: participant.displayName,
    role: participant.role,
    status: 'connecting',
    audio_enabled: true,
    video_enabled: true,
    screen_sharing: false,
    joined_at: now,
    last_seen_at: now,
  })
}

export async function updateLiveRoomParticipant(
  sessionId: string,
  userId: string,
  updates: Partial<
    Pick<
      LiveRoomParticipant,
      | 'status'
      | 'audio_enabled'
      | 'video_enabled'
      | 'screen_sharing'
    >
  >,
): Promise<void> {
  await updateDoc(participantRef(sessionId, userId), {
    ...updates,
    last_seen_at: new Date().toISOString(),
  })
}

export async function leaveLiveRoom(
  sessionId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(participantRef(sessionId, userId))
}

export function subscribeToLiveRoomParticipants(
  sessionId: string,
  onChange: (participants: LiveRoomParticipant[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(roomRef(sessionId), PARTICIPANTS),
    (snapshot) => {
      const participants = snapshot.docs
        .map((item) => toParticipant(item.id, item.data()))
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === 'tutor' ? -1 : 1
          return a.display_name?.localeCompare(b.display_name ?? '') ?? 0
        })

      onChange(participants)
    },
    (error) => {
      console.error('[liveRoom] Participant listener error:', error)
      onError?.(error)
    },
  )
}

export async function heartbeatLiveRoomParticipant(
  sessionId: string,
  userId: string,
): Promise<void> {
  await updateDoc(participantRef(sessionId, userId), {
    last_seen_at: new Date().toISOString(),
  })
}

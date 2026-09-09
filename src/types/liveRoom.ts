export type LiveRoomParticipantRole = 'tutor' | 'student'

export type LiveRoomParticipantStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export interface LiveRoomParticipant {
  id: string
  session_id: string
  user_id: string
  display_name: string | null
  role: LiveRoomParticipantRole
  status: LiveRoomParticipantStatus
  audio_enabled: boolean
  video_enabled: boolean
  screen_sharing: boolean
  joined_at: string
  last_seen_at: string
}

export interface LiveRoomChatMessage {
  id: string
  session_id: string
  sender_id: string
  sender_name: string | null
  sender_role: LiveRoomParticipantRole
  message: string
  created_at: string
}

export interface LiveRoom {
  session_id: string
  status: 'waiting' | 'live' | 'ended'
  created_at: string
  updated_at: string
}

export type LiveRoomSignalKind = 'offer' | 'answer'

export interface LiveRoomSignal {
  from_user_id: string
  to_user_id: string
  kind: LiveRoomSignalKind
  sdp: string
  created_at: string
}

export interface LiveRoomIceCandidate {
  from_user_id: string
  to_user_id: string
  candidate: string
  sdp_mid: string | null
  sdp_m_line_index: number | null
  created_at: string
}

export interface LiveRoomConnection {
  student_id: string
  tutor_id: string
  offer: string | null
  answer: string | null
  updated_at: string
}

export type RecordingStatus = 'idle' | 'recording' | 'review' | 'sending';

export interface Reaction {
  id: number;
  emoji: string;
  fromMe: boolean;
  remoteJid: string | null;
  participantName: string | null;
}

export interface Message {
  id: string;
  chatId: number;
  fromMe: boolean;
  messageType: string | null;
  text: string | null;
  mediaUrl: string | null;
  mediaMimetype: string | null;
  mediaCaption: string | null;
  mediaFileLength?: string | null;
  mediaSeconds?: number | null;
  mediaIsPtt?: boolean | null;
  contactName?: string | null;
  contactVcard?: string | null;
  locationLatitude?: string | null;
  locationLongitude?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  status: string | null;
  isAi: boolean | null;
  isAutomation: boolean | null;
  quotedMessageId?: string | null;
  quotedMessageText?: string | null;
  isInternal?: boolean | null;
  participant?: string | null;
  participantName?: string | null;
  errorMessage?: string | null;
  timestamp: string;
  reactions?: Reaction[];
}

export interface QuickReply {
  id: number;
  shortcut: string;
  content: string;
}

export interface NewMessagePayload {
  id: string;
  remoteJid: string;
  instanceId?: number;
  fromMe: boolean;
  messageType: string;
  text: string | null;
  mediaUrl: string | null;
  mediaMimetype: string | null;
  mediaCaption: string | null;
  status?: string;
  timestamp: string;
}

export interface ChatDetails {
  remoteJid: string | null;
  name: string;
  profilePicUrl: string | null;
  lastCustomerInteraction: string | null;
  integration: string;
}

export interface ContactData {
  id: number;
  name: string;
  funnelStage?: { id: number; name: string } | null;
  assignedUser?: { id: number; name: string } | null;
  tags?: { id: number; name: string; color: string }[];
  notes?: string | null;
  customData?: Record<string, any>;
}

export interface TeamData {
  id: number;
}

export interface UserData {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

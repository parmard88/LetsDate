// API response types — exact mirror of backend response shapes
// Backend: http://10.0.2.2:3001

export type ApiUser = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

export type ProfileCompletion = {
  percentage: number;
  completedFields: number;
  totalFields: number;
};

export type Profile = {
  userId: string;
  email: string;
  displayName: string;
  bio: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  gender: string | null;
  city: string | null;
  country: string | null;
  preferredGender: string | null;
  minPreferredAge: number | null;
  maxPreferredAge: number | null;
  relationshipGoal: string | null;
  accountCreatedAt: string;
  profileCreatedAt: string | null;
  profileUpdatedAt: string | null;
  profileCompletion: ProfileCompletion;
};

export type Photo = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  isPrimary: boolean;
  position: number;
  createdAt: string;
};

export type DiscoveryProfile = {
  id: string;
  displayName: string;
  age: number;
  bio: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  relationshipGoal: string | null;
  primaryPhoto: {
    url: string;
    contentType: string;
    sizeBytes: number;
  };
};

export type MatchItem = {
  matchId: string;
  matchedAt: string;
  user: {
    id: string;
    displayName: string;
    age: number | null;
    gender: string | null;
    city: string | null;
    country: string | null;
    relationshipGoal: string | null;
    primaryPhoto: {
      url: string;
      contentType: string;
    } | null;
  };
};

export type Conversation = {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  user: {
    id: string;
    displayName: string;
    primaryPhoto: {
      url: string;
      contentType: string;
    } | null;
  };
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  } | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

// Request/Response envelopes

export type RegisterRequest = {
  displayName: string;
  email: string;
  password: string;
};

export type RegisterResponse = {
  success: boolean;
  message: string;
  user: ApiUser;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  user: ApiUser;
};

export type MeResponse = {
  success: true;
  user: ApiUser;
};

export type LogoutResponse = {
  success: boolean;
  message: string;
};

export type ProfileResponse = {
  success: boolean;
  profile: Profile;
  message?: string;
};

export type PhotosResponse = {
  success: boolean;
  photos: Photo[];
  message?: string;
};

export type PhotoResponse = {
  success: boolean;
  photo: Photo;
  message?: string;
};

export type DiscoveryResponse = {
  success: boolean;
  message?: string;
  profiles: DiscoveryProfile[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
};

export type SwipeResponse = {
  success: boolean;
  action: "like" | "pass";
  matched: boolean;
  matchId: string | null;
  message: string;
};

export type MatchesResponse = {
  success: boolean;
  count: number;
  matches: MatchItem[];
};

export type ConversationsResponse = {
  success: boolean;
  count: number;
  conversations: Conversation[];
};

export type MessagesResponse = {
  success: boolean;
  messages: Message[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type SendMessageResponse = {
  success: boolean;
  message: Message;
};

export type ReadResponse = {
  success: boolean;
  conversationId: string;
  readAt: string | null;
  count: number;
  messageIds: string[];
};

// Socket event types

export type MessageNewEvent = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type MessageReadEvent = {
  conversationId: string;
  messageIds: string[];
  readAt: string;
};

export type ConversationJoinPayload = {
  conversationId: string;
};

export type MessagePublishPayload = {
  messageId: string;
};

// Error

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

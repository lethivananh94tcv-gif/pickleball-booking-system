import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";

export interface PlayerProfile {
  PlayerProfileID?: number;
  UserID?: number;
  PlayingRole: string;
  ExperienceYears: number;
  SkillLevel: string;
  PlayStyle: string;
  Goal: string;
  Rating?: number;
  MatchingStatus: string;
  AvailableStartTime?: string | null;
  AvailableEndTime?: string | null;
  FullName?: string;
  Email?: string;
  PhoneNumber?: string;
  AvatarURL?: string;
  Gender?: string;
}

export interface PlayGroup {
  GroupID: number;
  GroupName: string;
  CreatorID: number;
  MaxPlayers: number;
  CurrentPlayers: number;
  SkillLevel: string;
  Status: string;
  Description: string;
  CreatedAt: string;
  CreatorName?: string;
  CreatorAvatar?: string;
  CreatorEmail?: string;
  members?: any[];
  AverageExperience?: number;
  IsChallengeChat?: number | boolean;
  MyRole?: string;
}

export interface PlayInvitation {
  InvitationID: number;
  SenderID: number;
  ReceiverID: number;
  GroupID: number | null;
  InvitationType: string;
  Message: string;
  Status: string;
  CreatedAt: string;
  SenderName?: string;
  SenderEmail?: string;
  SenderAvatar?: string;
  ReceiverName?: string;
  ReceiverEmail?: string;
  ReceiverAvatar?: string;
  GroupName?: string;
  ReceiverGroupName?: string;
  ChallengeDate?: string | null;
  ChallengeStartTime?: string | null;
  ChallengeEndTime?: string | null;
  SenderSkillLevel?: string;
  SenderExperienceYears?: number;
  SenderStartTime?: string;
  SenderEndTime?: string;
  ReceiverSkillLevel?: string;
  ReceiverExperienceYears?: number;
  ReceiverStartTime?: string;
  ReceiverEndTime?: string;
}

export async function getPlayerProfile(token: string): Promise<PlayerProfile | null> {
  const response = await apiClient<ApiResponse<PlayerProfile | null>>("/api/player-matching/profile", {
    token,
  });
  return response.data;
}

export async function savePlayerProfile(token: string, payload: PlayerProfile): Promise<PlayerProfile> {
  const response = await apiClient<ApiResponse<PlayerProfile>>("/api/player-matching/profile", {
    method: "POST",
    token,
    body: payload,
  });
  return response.data;
}

export async function getSuitableTeammates(token: string): Promise<any[]> {
  const response = await apiClient<ApiResponse<any[]>>("/api/player-matching/teammates", {
    token,
  });
  return response.data;
}

export async function getSuitableOpponents(token: string, groupId: number): Promise<any[]> {
  const response = await apiClient<ApiResponse<any[]>>(`/api/player-matching/opponents?groupId=${groupId}`, {
    token,
  });
  return response.data;
}

export async function getUserGroups(token: string): Promise<any[]> {
  const response = await apiClient<ApiResponse<any[]>>("/api/player-matching/my-groups", {
    token,
  });
  return response.data;
}

export async function getPlayGroups(
  token: string,
  filters: { skillLevel?: string; keyword?: string } = {}
): Promise<PlayGroup[]> {
  let query = "";
  const params = [];
  if (filters.skillLevel) params.push(`skillLevel=${filters.skillLevel}`);
  if (filters.keyword) params.push(`keyword=${encodeURIComponent(filters.keyword)}`);
  if (params.length > 0) query = `?${params.join("&")}`;

  const response = await apiClient<ApiResponse<PlayGroup[]>>(`/api/playgroups${query}`, {
    token,
  });
  return response.data;
}

export async function getGroupDetails(token: string, groupId: number): Promise<PlayGroup> {
  const response = await apiClient<ApiResponse<PlayGroup>>(`/api/playgroups/${groupId}`, {
    token,
  });
  return response.data;
}

export async function createGroup(token: string, payload: { groupName: string; skillLevel: string; description?: string }): Promise<PlayGroup> {
  const response = await apiClient<ApiResponse<PlayGroup>>("/api/playgroups", {
    method: "POST",
    token,
    body: payload,
  });
  return response.data;
}

export async function joinGroup(token: string, groupId: number): Promise<PlayGroup> {
  const response = await apiClient<ApiResponse<PlayGroup>>(`/api/playgroups/${groupId}/join`, {
    method: "POST",
    token,
  });
  return response.data;
}

export async function leaveGroup(token: string, groupId: number): Promise<any> {
  const response = await apiClient<ApiResponse<any>>(`/api/playgroups/${groupId}/leave`, {
    method: "POST",
    token,
  });
  return response.data;
}

export interface GroupMessage {
  MessageID: number;
  GroupID: number;
  SenderID: number;
  SenderName?: string;
  SenderAvatar?: string;
  Content: string;
  CreatedAt: string;
  IsMine?: boolean;
}

export async function getGroupMessages(token: string, groupId: number): Promise<GroupMessage[]> {
  const response = await apiClient<ApiResponse<GroupMessage[]>>(`/api/playgroups/${groupId}/messages`, {
    token,
  });
  return response.data;
}

export async function sendGroupMessage(token: string, groupId: number, content: string): Promise<GroupMessage> {
  const response = await apiClient<ApiResponse<GroupMessage>>(`/api/playgroups/${groupId}/messages`, {
    method: "POST",
    token,
    body: { content },
  });
  return response.data;
}

export async function pinGroupMessage(token: string, groupId: number, messageId: number): Promise<void> {
  await apiClient<ApiResponse<any>>(`/api/playgroups/${groupId}/messages/${messageId}/pin`, {
    method: "POST",
    token,
  });
}

export async function unpinGroupMessage(token: string, groupId: number, messageId: number): Promise<void> {
  await apiClient<ApiResponse<any>>(`/api/playgroups/${groupId}/messages/${messageId}/unpin`, {
    method: "POST",
    token,
  });
}


export async function closeGroup(token: string, groupId: number): Promise<PlayGroup> {
  const response = await apiClient<ApiResponse<PlayGroup>>(`/api/playgroups/${groupId}/close`, {
    method: "PATCH",
    token,
  });
  return response.data;
}

export async function getReceivedInvitations(token: string): Promise<PlayInvitation[]> {
  const response = await apiClient<ApiResponse<PlayInvitation[]>>("/api/play-invitations/received", {
    token,
  });
  return response.data;
}

export async function getSentInvitations(token: string): Promise<PlayInvitation[]> {
  const response = await apiClient<ApiResponse<PlayInvitation[]>>("/api/play-invitations/sent", {
    token,
  });
  return response.data;
}

export async function sendInvitation(
  token: string,
  payload: {
    receiverId: number | null;
    groupId: number | null;
    targetGroupId?: number | null;
    invitationType: string;
    message?: string;
    challengeDate?: string;
    challengeStartTime?: string;
    challengeEndTime?: string;
  }
): Promise<PlayInvitation> {
  const response = await apiClient<ApiResponse<PlayInvitation>>("/api/play-invitations", {
    method: "POST",
    token,
    body: payload,
  });
  return response.data;
}

export async function acceptInvitation(token: string, invitationId: number): Promise<any> {
  const response = await apiClient<ApiResponse<any>>(`/api/play-invitations/${invitationId}/accept`, {
    method: "POST",
    token,
  });
  return response.data;
}

export async function rejectInvitation(token: string, invitationId: number): Promise<any> {
  const response = await apiClient<ApiResponse<any>>(`/api/play-invitations/${invitationId}/reject`, {
    method: "POST",
    token,
  });
  return response.data;
}

export async function updateGroup(
  token: string,
  groupId: number,
  payload: {
    groupName: string;
    skillLevel: string;
    averageExperience: number;
    description: string;
    status: string;
  }
): Promise<any> {
  const response = await apiClient<ApiResponse<any>>(`/api/playgroups/${groupId}`, {
    method: "PATCH",
    token,
    body: payload,
  });
  return response.data;
}

export async function getPendingInvitationCount(token: string): Promise<{ count: number }> {
  const response = await apiClient<ApiResponse<{ count: number }>>("/api/play-invitations/pending-count", {
    token,
  });
  return response.data;
}

export interface UnreadCountsResponse {
  totalUnread: number;
  groups: { groupId: number; unreadCount: number }[];
}

export async function getUnreadGroupChatCounts(token: string): Promise<UnreadCountsResponse> {
  const response = await apiClient<ApiResponse<UnreadCountsResponse>>("/api/playgroups/unread-counts", {
    token,
  });
  return response.data;
}

export async function markGroupMessagesAsRead(token: string, groupId: number): Promise<void> {
  await apiClient<ApiResponse<null>>(`/api/playgroups/${groupId}/messages/read`, {
    method: "POST",
    token,
  });
}

export interface AITeammateResult {
  player: PlayerProfile;
  score: number | null;
  reasons: string[];
}

export interface AITeammateResponse {
  success: boolean;
  mode: "teammate";
  fallback: boolean;
  fallbackReason?: string;
  results: AITeammateResult[];
}

export interface AIOpponentResult {
  opponentTeam: {
    players: PlayerProfile[];
    groupId?: number | null;
    creatorId?: number | null;
  };
  opponentTeamId: string;
  teamPower: number;
  score: number | null;
  reasons: string[];
}

export interface AIOpponentResponse {
  success: boolean;
  mode: "opponent_team";
  fallback: boolean;
  fallbackReason?: string;
  myTeam: {
    players: PlayerProfile[];
    teamPower: number;
  };
  results: AIOpponentResult[];
}

export async function matchTeammatesByAI(token: string): Promise<AITeammateResponse> {
  const response = await apiClient<any>("/api/ai/players/match-teammates", {
    method: "POST",
    token,
  });
  const data = response?.data || response;
  return data || { success: true, mode: "teammate", fallback: true, results: [] };
}

export async function matchOpponentsByAI(token: string, teammateId?: string): Promise<AIOpponentResponse> {
  const response = await apiClient<any>("/api/ai/players/match-opponents", {
    method: "POST",
    token,
    body: teammateId ? { teammateId } : undefined,
  });
  const data = response?.data || response;
  return data || { success: true, mode: "opponent_team", fallback: true, results: [] };
}

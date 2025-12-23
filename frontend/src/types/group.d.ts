export interface UserData {
  id: string;
  email: string;
  name: string;
}

export interface UserGroupResponseDto {
  id: string;
  userId: string;
  groupId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | string;
  user: UserData;
}

export interface GroupResponseDto {
  id: string;
  name: string;
  creatorId: string;
  createdAt: string;
  users?: UserGroupResponseDto[];
}

export interface GroupCreateDto {
  name: string;
  userEmails: string[];
  votingIds?: string[];
}

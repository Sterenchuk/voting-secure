export class UserGroupResponseDto {
  id: string;
  userId: string;
  groupId: string;
  role: string;
}

export const SELECT_USER_GROUP_FIELDS = {
  id: true,
  userId: true,
  groupId: true,
  role: true,
} as const;

export class UserResponseDto {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SELECT_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

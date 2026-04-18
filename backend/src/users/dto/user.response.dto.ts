export class UserResponseDto {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SELECT_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

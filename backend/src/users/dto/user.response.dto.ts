export class UserResponseDto {
  id: string;
  email: string;
  name?: string | null;
  role: string;

  language: string;
  theme: string;

  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SELECT_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  language: true,
  theme: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

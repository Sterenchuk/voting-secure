export class UserDto {
  id: string;
  role: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;

  groups?: any[]; // you can create DTOs for each relation if needed
  votes?: any[];
  refreshTokens?: any[];
}

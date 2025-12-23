export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    preferences?: {
      theme: string;
      notifications: boolean;
    };
  };
}

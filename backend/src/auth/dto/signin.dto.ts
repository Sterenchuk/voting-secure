import { IsString, IsEmail, IsStrongPassword } from 'class-validator';

export class SignInDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @IsString()
  @IsStrongPassword(
    { minLength: 4 },
    {
      message:
        'Password must be at least 4 characters long and meet complexity requirements (e.g., uppercase, lowercase, number, symbol).',
    },
  )
  password: string;
}

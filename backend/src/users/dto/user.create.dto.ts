import {
  IsString,
  IsEmail,
  IsStrongPassword,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from '../../common/enums/role';
export class UserCreateDto {
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

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long.' })
  name: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

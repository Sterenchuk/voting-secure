import { IsString, IsEmail, IsEnum, IsUUID } from 'class-validator';
import { Role } from '../../common/enums/role';

export class UserPayloadDto {
  @IsUUID()
  sub: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsEnum(Role)
  role: Role;
}

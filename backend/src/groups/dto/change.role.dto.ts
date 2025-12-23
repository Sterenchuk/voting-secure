import { GroupRole } from 'src/common/enums/group-role';
import { IsEmail, IsEnum } from 'class-validator';

export class ChangeRoleDto {
  @IsEmail({}, { message: 'User email must be a valid email address.' })
  userEmail: string;

  @IsEnum(GroupRole)
  role: GroupRole;
}

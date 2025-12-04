import { GroupRole } from 'src/common/enums/group-role';
import { IsUUID, IsEnum } from 'class-validator';

export class ChangeRoleDto {
  @IsUUID(4, { message: 'User ID must be a valid UUID.' })
  userId: string;

  @IsEnum(GroupRole)
  role?: GroupRole;
}

import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AddUsersDto {
  @IsArray()
  @IsUUID(4, { each: true, message: 'Each voting ID must be a valid UUID.' })
  userIds: string[];
}

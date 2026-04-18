import {
  IsString,
  MinLength,
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { GroupRole } from '../../common/enums/group-role';

export class GroupCreateDto {

  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters long.' })
  name: string;

  @ArrayMinSize(1, { message: 'Provide at least one user email.' })
  @IsEmail(
    {},
    { each: true, message: 'Each user email must be a valid email address.' },
  )
  userEmails: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true, message: 'Each voting ID must be a valid UUID.' })
  votingIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true, message: 'Each survey ID must be a valid UUID.' })
  surveyIds?: string[]; // Added for survey association
}

export class GroupUpdateDto extends PartialType(GroupCreateDto) {}

export class AddUsersDto {
  @IsArray()
  @IsEmail(
    {},
    { each: true, message: 'Each user email must be a valid email address.' },
  )
  userEmails: string[];
}

export class ChangeRoleDto {
  @IsEmail({}, { message: 'User email must be a valid email address.' })
  userEmail: string;

  @IsEnum(GroupRole)
  role: GroupRole;
}

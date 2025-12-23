import {
  IsString,
  MinLength,
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsEmail,
  IsOptional,
} from 'class-validator';

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
}

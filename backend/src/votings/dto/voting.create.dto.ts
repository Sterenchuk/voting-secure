import {
  IsString,
  MinLength,
  IsOptional,
  IsUUID,
  IsDate,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class VotingCreateDto {
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long.' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsUUID(4, { message: 'Group ID must be a valid UUID.' })
  groupId: string;

  @IsDate()
  @IsOptional()
  startAt?: Date;

  @IsDate()
  @IsOptional()
  endAt?: Date;

  @IsArray()
  @ArrayMinSize(2, { message: 'Provide at least two options.' })
  @IsString({ each: true, message: 'Each option must be a string.' })
  options: string[];
}

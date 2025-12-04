import {
  IsString,
  MinLength,
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class GroupCreateDto {
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters long.' })
  name: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Provide at least one user ID.' })
  @IsUUID(4, { each: true, message: 'Each user ID must be a valid UUID.' })
  userIds: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true, message: 'Each voting ID must be a valid UUID.' })
  votingIds?: string[];
}

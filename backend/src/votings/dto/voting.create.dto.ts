import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDateString,
  IsArray,
  ArrayMinSize,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { VotingType } from '../types/voting.types';

export class VotingCreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsString()
  groupId: string;

  @IsOptional()
  @IsEnum(VotingType)
  type?: VotingType;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @Transform(({ value }) => (value as string[]).map((v) => v.trim()))
  options: string[];

  @IsOptional()
  @IsBoolean()
  allowOther?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minChoices?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxChoices?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}

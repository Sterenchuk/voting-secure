import {
  IsArray,
  IsUUID,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CastVoteDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsArray()
  @IsUUID('4', { each: true })
  optionIds: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  otherText?: string;

  @IsOptional()
  @IsBoolean()
  isAbstention?: boolean;

  @IsOptional()
  @IsBoolean()
  isPractice?: boolean;
}

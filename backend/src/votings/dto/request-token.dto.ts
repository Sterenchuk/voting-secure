import {
  IsArray,
  IsUUID,
  IsString,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestTokenDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  optionIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  otherText?: string;
}

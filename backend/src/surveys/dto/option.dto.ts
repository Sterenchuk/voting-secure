import { IsString, IsInt, IsOptional, MinLength, MaxLength, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class SurveyOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateSurveyOptionDto extends PartialType(SurveyOptionDto) {}

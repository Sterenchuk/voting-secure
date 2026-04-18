import {
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { SurveyQuestionType } from '../types/survey.types';
import { SurveyOptionDto } from './option.dto';

export class SurveyChoiceConfigDto {
  @IsOptional()
  @IsBoolean()
  allowOther?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minChoices?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxChoices?: number;
}

export class SurveyScaleConfigDto {
  @IsInt()
  scaleMin: number;

  @IsInt()
  @Min(1)
  scaleMax: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  step?: number;
}

export class SurveyQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;

  @IsEnum(SurveyQuestionType)
  type: SurveyQuestionType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SurveyChoiceConfigDto)
  choiceConfig?: SurveyChoiceConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SurveyScaleConfigDto)
  scaleConfig?: SurveyScaleConfigDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => SurveyOptionDto)
  options?: SurveyOptionDto[];
}

/**
 * For surgical updates of a question.
 * Options are excluded because they should be updated via their own endpoints.
 */
export class UpdateSurveyQuestionDto extends PartialType(
  OmitType(SurveyQuestionDto, ['options'] as const),
) {
  id: string;
}

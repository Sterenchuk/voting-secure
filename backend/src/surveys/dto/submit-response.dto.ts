import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SurveyBallotInputDto {
  @IsUUID()
  questionId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  optionIds?: string[];

  @IsOptional()
  @IsString()
  text?: string;
}

export class SubmitSurveyResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyBallotInputDto)
  ballots: SurveyBallotInputDto[];

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsBoolean()
  isAbstention?: boolean;

  @IsOptional()
  @IsBoolean()
  isPractice?: boolean;
}

export class RequestSurveyTokenDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SurveyBallotInputDto)
  ballots?: SurveyBallotInputDto[];

  @IsOptional()
  @IsBoolean()
  isAbstention?: boolean;

  @IsOptional()
  @IsBoolean()
  isPractice?: boolean;
}

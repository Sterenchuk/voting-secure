import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SurveyBallotInputDto {
  @IsUUID()
  questionId: string;

  @IsOptional()
  @IsUUID()
  optionId?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsString()
  ballotHash: string;
}

export class SubmitSurveyResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyBallotInputDto)
  ballots: SurveyBallotInputDto[];
}

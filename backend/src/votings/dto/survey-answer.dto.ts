import { IsArray, IsUUID } from 'class-validator';

export class SurveyAnswerDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  optionIds: string[];
}

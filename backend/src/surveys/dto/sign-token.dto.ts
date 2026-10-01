import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SurveyBallotInputDto } from './submit-response.dto';

export class SignSurveyTokenDto {
  @IsString()
  token: string; // T — сирий секретний токен (сервер обчислює tokenHash = HMAC-SHA256(T))

  @IsString()
  blinded: string; // T · r^e (mod n)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyBallotInputDto)
  ballots: SurveyBallotInputDto[];

  @IsOptional()
  @IsBoolean()
  isAbstention?: boolean;

  @IsOptional()
  @IsBoolean()
  isPractice?: boolean;
}

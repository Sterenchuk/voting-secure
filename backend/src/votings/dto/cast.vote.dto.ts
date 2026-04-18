import {
  IsArray,
  IsUUID,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class BallotItemDto {
  @IsUUID('4')
  optionId: string;

  @IsString()
  @IsNotEmpty()
  ballotHash: string;
}

export class CastVoteDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BallotItemDto)
  ballots: BallotItemDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  otherText?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  freeformBallotHash?: string;
}

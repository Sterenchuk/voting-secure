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
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class BallotItemDto {
  @IsUUID('4')
  optionId: string;
}

export class CastVoteDto {
  @IsNotEmpty()
  @IsString()
  token: string;

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
  @IsBoolean()
  isAbstention?: boolean;
}

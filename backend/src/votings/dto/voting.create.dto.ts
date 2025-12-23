// backend/src/votings/dto/voting.create.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsInt,
  Min,
  ValidateNested,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum VotingType {
  STANDARD = 'STANDARD', // Classic single-choice poll
  FRIENDLY = 'FRIENDLY', // Friends deciding together - users can add options
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE', // Multiple selections allowed
  SURVEY = 'SURVEY', // Multiple questions, collect all responses
}

export enum RandomizerType {
  NONE = 'NONE',
  COIN_FLIP = 'COIN_FLIP', // For 2 options
  ROULETTE = 'ROULETTE', // For 3+ options
  PLINKO = 'PLINKO', // For 2 options (ball drop)
  SPINNER = 'SPINNER', // Wheel of fortune
  DICE_ROLL = 'DICE_ROLL', // For 2-6 options
}

export class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class QuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  description?: string; // Optional context for the question

  @IsBoolean()
  @IsOptional()
  allowMultiple?: boolean; // Can select multiple options for this question

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];
}

export class VotingCreateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  groupId: string;

  @IsEnum(VotingType)
  @IsOptional()
  type?: VotingType = VotingType.STANDARD;

  @IsEnum(RandomizerType)
  @IsOptional()
  randomizerType?: RandomizerType = RandomizerType.NONE;

  @IsBoolean()
  @IsOptional()
  isOpen?: boolean = false;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsDateString()
  @IsOptional()
  optionsLockAt?: string; // For FRIENDLY type

  // Standard voting options
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  // FRIENDLY voting settings
  @IsBoolean()
  @IsOptional()
  allowUserOptions?: boolean = false;

  // MULTIPLE_CHOICE settings
  @IsBoolean()
  @IsOptional()
  allowMultiple?: boolean = false;

  @IsInt()
  @Min(1)
  @IsOptional()
  minChoices?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxChoices?: number;

  // SURVEY settings
  @IsBoolean()
  @IsOptional()
  isSurvey?: boolean = false;

  @IsBoolean()
  @IsOptional()
  showAggregateResults?: boolean = true; // Show how everyone answered

  @IsBoolean()
  @IsOptional()
  allowAnonymous?: boolean = false; // Hide who answered what

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  @IsOptional()
  questions?: QuestionDto[];
}

import { IsOptional, IsString, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class FindVotingQueryDto {
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsISO8601()
  @Type(() => Date)
  startAt?: Date;

  @IsOptional()
  @IsISO8601()
  @Type(() => Date)
  endAt?: Date;

  @IsOptional()
  @Type(() => Boolean)
  isOpen?: boolean;
}

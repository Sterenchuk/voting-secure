import { IsUUID } from 'class-validator';

export class VoteDto {
  @IsUUID()
  votingId: string;

  @IsUUID()
  optionId: string;
}

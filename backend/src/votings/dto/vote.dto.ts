import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class VoteDto {
  @IsUUID()
  votingId: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  optionIds: string[];
}

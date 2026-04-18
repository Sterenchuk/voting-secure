import { PartialType, OmitType } from '@nestjs/mapped-types';
import { VotingCreateDto } from './voting.create.dto';

export class VotingUpdateDto extends PartialType(VotingCreateDto) {}

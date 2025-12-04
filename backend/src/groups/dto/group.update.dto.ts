import { PartialType } from '@nestjs/mapped-types';
import { GroupCreateDto } from './group.create.dto';
import { isUUID } from 'class-validator';
export class GroupUpdateDto extends PartialType(GroupCreateDto) {}

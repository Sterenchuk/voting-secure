import { IsOptional, IsString } from 'class-validator';

export class FindAllGroupsDto {
  @IsOptional()
  @IsString()
  name?: string;
}

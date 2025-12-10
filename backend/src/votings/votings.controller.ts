import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';

import { VotingsService } from './votings.service';

import { VotingCreateDto } from './dto/voting.create.dto';
import { UserPayloadDto } from 'src/auth/dto/payload.dto';
import { UuidDto } from 'src/common/utils/uuid.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';
import { VoteDto } from './dto/vote.dto';

@Controller('votings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class VotingsController {
  constructor(private readonly votingsService: VotingsService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() votingCreateDto: VotingCreateDto,
  ) {
    return this.votingsService.create(votingCreateDto);
  }

  @Get()
  findAll(
    @Query('groupId') groupId?: string,
    @Query('title') title?: string,
    @Query('startAt') startAt?: Date,
    @Query('endAt') endAt?: Date,
  ) {
    return this.votingsService.findAll(groupId, title, startAt, endAt);
  }

  @Get(':id')
  findOne(@Param('id') id: UuidDto['id']) {
    return this.votingsService.findOne(id);
  }

  @Get(':id/options')
  getOptions(@Param('id') id: UuidDto['id']) {
    return this.votingsService.getVotingOptions(id);
  }
  //   @Get(':id/results')
  //   getResults(@Param('id') id: UuidDto['id']) {
  //     return this.votingsService.getVotingResults(id);
  //   }

  @Put(':id')
  update(
    @Param('id') id: UuidDto['id'],
    @Body() votingUpdateDto: VotingUpdateDto,
  ) {
    return this.votingsService.update(id, votingUpdateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: UuidDto['id']) {
    return this.votingsService.delete(id);
  }

  @Post('vote')
  async vote(
    @Body() voteDto: VoteDto,
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
  ) {
    return this.votingsService.vote(voteDto.votingId, voteDto.optionId, userId);
  }
}

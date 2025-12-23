import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';
import { VotingsService } from './votings.service';
import { VotingCreateDto } from './dto/voting.create.dto';
import { VotingResponseDto } from './dto/voting.response.dto';
import { OptionResponseDto } from './dto/option.response.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';
import { VoteDto } from './dto/vote.dto';
import { SurveyAnswerDto } from './dto/survey-answer.dto';
import { FindVotingQueryDto } from './dto/find.voting.query.dto';

@Controller('votings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class VotingsController {
  constructor(private readonly votingsService: VotingsService) {}

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() votingCreateDto: VotingCreateDto,
  ): Promise<VotingResponseDto> {
    return this.votingsService.create(votingCreateDto, userId);
  }

  @Get()
  async findAll(
    @Query() query: FindVotingQueryDto,
  ): Promise<VotingResponseDto[]> {
    const { groupId, title, startAt, endAt, isOpen } = query;
    return this.votingsService.findAll(groupId, title, startAt, endAt, isOpen);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<any> {
    return this.votingsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() votingUpdateDto: VotingUpdateDto,
  ): Promise<VotingResponseDto> {
    return this.votingsService.update(id, votingUpdateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.votingsService.delete(id);
  }

  @Post('vote')
  async vote(
    @Body() body: { votingId: string; optionId: string | string[] },
    @CurrentUser('sub') userId: string,
  ) {
    const optionIds = Array.isArray(body.optionId)
      ? body.optionId
      : [body.optionId];
    return this.votingsService.vote(body.votingId, optionIds, userId);
  }

  @Post(':id/options')
  async addOption(
    @Param('id') votingId: string,
    @CurrentUser('sub') userId: string,
    @Body('text') text: string,
  ): Promise<OptionResponseDto> {
    return this.votingsService.addOption(votingId, userId, text);
  }

  @Patch(':id/options/:optionId')
  async updateOption(
    @Param('id') votingId: string,
    @Param('optionId') optionId: string,
    @CurrentUser('sub') userId: string,
    @Body('text') text: string,
  ): Promise<OptionResponseDto> {
    return this.votingsService.updateOption(votingId, optionId, userId, text);
  }

  @Delete(':id/options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOption(
    @Param('id') votingId: string,
    @Param('optionId') optionId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.votingsService.deleteOption(votingId, optionId, userId);
  }

  @Get(':id/results')
  async getResults(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const voting = await this.votingsService.findOne(id);
    if (voting?.isSurvey) {
      return this.votingsService.getSurveyResults(id, userId);
    }
    return this.votingsService.getVotingResults(id);
  }

  @Get(':id/user-vote')
  async getUserVote(
    @Param('id') votingId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ optionId?: string }> {
    return this.votingsService.getUserVote(votingId, userId);
  }

  @Post(':id/survey')
  async submitSurvey(
    @Param('id') id: string,
    @Body() answers: { questionId: string; optionIds: string[] }[],
    @CurrentUser('sub') userId: string,
  ) {
    return this.votingsService.submitSurveyAnswer(id, answers, userId);
  }
}

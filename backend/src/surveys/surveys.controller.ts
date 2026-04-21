import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SubmitService } from './submit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayloadDto } from '../auth/dto/payload.dto';
import {
  SurveyCreateDto,
  SurveyUpdateDto,
  FindSurveyQueryDto,
} from './dto/survey.dto';
import { UpdateSurveyQuestionDto } from './dto/question.dto';
import { SurveyOptionDto, UpdateSurveyOptionDto } from './dto/option.dto';
import { SubmitSurveyResponseDto } from './dto/submit-response.dto';
import { Audit, ChainAction } from '../audit/audit.decorator';

@Controller('surveys')
@UseGuards(JwtAuthGuard)
export class SurveysController {
  constructor(
    private readonly surveysService: SurveysService,
    private readonly submitService: SubmitService,
  ) {}

  // ─── Survey Management (Creators/Admins) ───────────────────────────────────

  @Post()
  @Audit({
    action: ChainAction.SURVEY_CREATED,
    extractPayload: (res: any) => ({
      surveyId: res.id,
      title: res.title,
    }),
  })
  async create(
    @CurrentUser() user: UserPayloadDto,
    @Body() dto: SurveyCreateDto,
  ) {
    return this.surveysService.create(user.sub, dto);
  }

  @Get()
  async findAll(@Query() query: FindSurveyQueryDto) {
    return this.surveysService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveysService.findOne(id);
  }

  @Put(':id')
  @Audit({
    action: ChainAction.SURVEY_UPDATED,
    extractPayload: (res: any) => ({
      surveyId: res.id,
      updatedFields: res,
    }),
  })
  async update(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SurveyUpdateDto,
  ) {
    return this.surveysService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: ChainAction.SURVEY_DELETED,
    extractPayload: (_res, req: any) => ({
      surveyId: req.params.id,
    }),
  })
  async delete(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.surveysService.delete(user.sub, id);
  }

  // ─── Question & Option Management ──────────────────────────────────────────

  @Put(':id/questions')
  @Audit({
    action: ChainAction.SURVEY_UPDATED,
    extractPayload: (_res, req: any) => ({
      surveyId: req.params.id,
      action: 'UPDATE_QUESTIONS',
    }),
  })
  async updateQuestions(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() questions: UpdateSurveyQuestionDto[],
  ) {
    return this.surveysService.updateQuestions(user.sub, id, questions);
  }

  @Post('questions/:questionId/options')
  async addOption(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: SurveyOptionDto,
  ) {
    return this.surveysService.addOption(questionId, dto);
  }

  @Put('options/:optionId')
  async updateOption(
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() dto: UpdateSurveyOptionDto,
  ) {
    return this.surveysService.updateOption(optionId, dto);
  }

  @Delete('options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOption(@Param('id', ParseUUIDPipe) optionId: string) {
    return this.surveysService.deleteOption(optionId);
  }

  // ─── Participation & Results ───────────────────────────────────────────────

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: ChainAction.SURVEY_BALLOT_CAST,
    extractPayload: (_res, req: any) => ({
      surveyId: req.params.id,
      // choices are NOT logged
    }),
  })
  async submit(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitSurveyResponseDto,
  ) {
    return this.submitService.submitResponse(id, user.sub, dto.ballots);
  }

  @Get(':id/results')
  async getResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeRaw', ParseBoolPipe) includeRaw = false,
  ) {
    const survey = await this.surveysService.findOne(id);
    const questionIds = survey.questions.map((q) => q.id);

    return this.submitService.getResults(id, questionIds, includeRaw);
  }
}

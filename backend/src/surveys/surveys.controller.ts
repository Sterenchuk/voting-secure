import { EmlGenerator } from '../common/utils/eml-generator';
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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SurveysService } from './surveys.service';
import { SubmitService } from './submit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GroupRoleGuard } from '../common/guards/group-role.guard';
import { GroupRoles } from '../common/decorators/group-roles.decorator';
import { StrictGroupCheck } from '../common/decorators/strict-group-check.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserPayloadDto } from '../auth/dto/payload.dto';
import { GroupRole } from '../common/enums/group-role';
import {
  SurveyCreateDto,
  SurveyUpdateDto,
  FindSurveyQueryDto,
} from './dto/survey.dto';
import { UpdateSurveyQuestionDto } from './dto/question.dto';
import { SurveyOptionDto, UpdateSurveyOptionDto } from './dto/option.dto';
import {
  SubmitSurveyResponseDto,
} from './dto/submit-response.dto';
import { SignSurveyTokenDto } from './dto/sign-token.dto';
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
  async findAll(
    @Query() query: FindSurveyQueryDto,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.surveysService.findAll(query, user.sub);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.surveysService.findOne(id, user.sub);
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
  async deleteOption(@Param('optionId', ParseUUIDPipe) optionId: string) {
    return this.surveysService.deleteOption(optionId);
  }

  // ─── Participation & Results ───────────────────────────────────────────────

  @Post(':id/sign')
  async signToken(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignSurveyTokenDto,
  ) {
    return this.submitService.signBlindedToken(
      id,
      { id: user.sub, email: user.email, language: user.language, theme: user.theme },
      dto,
    );
  }

  @Get(':id/signing-key')
  @Public()
  async signingKey(@Param('id', ParseUUIDPipe) id: string) {
    const key = await this.submitService.getSigningKey(id);
    return {
      modulus: key.modulusHex,
      exponent: key.exponentHex,
      keySize: key.keySize,
    };
  }

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
    return this.submitService.submitResponse(
      id,
      user.sub,
      dto.ballots,
      dto.token,
      dto.signature,
      dto.isAbstention ?? false,
      dto.isPractice ?? false,
    );
  }

  @Get(':id/results')
  async getResults(
    @Param('id', ParseUUIDPipe) id: string,

    @Query('includeRaw', new ParseBoolPipe({ optional: true }))
    includeRaw = false,
  ) {
    const survey = await this.surveysService.findOne(id);
    const questionIds = survey.questions.map((q) => q.id);

    return this.submitService.getResults(id, questionIds, includeRaw);
  }

  @Get(':id/participation-stats')
  async getParticipationStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.submitService.getParticipationStats(id);
  }

  @Post(':id/finalize')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.ADMIN, GroupRole.OWNER)
  @StrictGroupCheck()
  @Audit({
    action: ChainAction.SURVEY_FINALIZED,
    extractPayload: (res: any) => ({
      surveyId: res.id,
      finalizedAt: res.finalizedAt,
    }),
  })
  async finalize(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submitService.finalizeSurvey(id, user.sub);
  }

  @Get(':id/results/eml')
  async downloadEml(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Res() res: Response,
  ) {
    const survey = await this.surveysService.findOne(id);
    const questionIds = survey.questions.map((q) => q.id);
    const results = await this.submitService.getResults(id, questionIds, true);
    const stats = await this.submitService.getParticipationStats(id);

    const xml = EmlGenerator.generateSurveyEML(survey, results, stats);

    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="survey-${id}-results.xml"`,
    });

    return res.status(HttpStatus.OK).send(xml);
  }

  @Get(':id/results/csv')
  async downloadCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Res() res: Response,
  ) {
    const survey = await this.surveysService.findOne(id);
    const questionIds = survey.questions.map((q) => q.id);
    const results = await this.submitService.getResults(id, questionIds, true);

    let csv = 'Question,Type,Option,Count,Percentage\n';
    results.results.forEach((qRes) => {
      const question = survey.questions.find((q) => q.id === qRes.questionId);
      const qText = question?.text || 'Unknown';
      const qType = question?.type || 'Unknown';
      const qTotal = (qRes.options.reduce((sum, opt) => sum + opt.count, 0) + (qRes.otherCount || 0)) || 1;

      qRes.options.forEach((opt) => {
        const pct = ((opt.count / qTotal) * 100).toFixed(2);
        csv += `"${qText.replace(/"/g, '""')}","${qType}","${opt.text.replace(/"/g, '""')}",${opt.count},${pct}%\n`;
      });
      if ((qRes.otherCount ?? 0) > 0) {
        const otherCount = qRes.otherCount || 0;
        const pct = ((otherCount / qTotal) * 100).toFixed(2);
        csv += `"${qText.replace(/"/g, '""')}","${qType}","Other",${otherCount},${pct}%\n`;
      }
    });

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="survey-${id}-results.csv"`,
    });

    return res.status(HttpStatus.OK).send(csv);
  }

  @Get(':id/my-status')
  async getMyStatus(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submitService.getUserSurveyStatus(id, user.sub);
  }

  @Get(':id/verify-receipt')
  @Public()
  async verifyReceipt(
    @Param('id') surveyId: string,
    @Query('hash') hash: string | string[],
  ) {
    const results = await this.submitService.verifyReceipt(surveyId, hash);
    const missing = results.filter((r) => !r.found).map((r) => r.hash);

    return {
      valid: missing.length === 0,
      missingHashes: missing.length > 0 ? missing : undefined,
      results,
    };
  }
}

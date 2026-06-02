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
  RequestSurveyTokenDto,
} from './dto/submit-response.dto';
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

    let csv = 'Question,Option,Count\n';
    results.results.forEach((qRes) => {
      const question = survey.questions.find((q) => q.id === qRes.questionId);
      const qText = question?.text || 'Unknown';

      qRes.options.forEach((opt) => {
        csv += `"${qText}","${opt.text}",${opt.count}\n`;
      });
      if ((qRes.otherCount ?? 0) > 0) {
        csv += `"${qText}","Other",${qRes.otherCount ?? 0}\n`;
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

  @Post(':id/token')
  async requestToken(
    @CurrentUser() user: UserPayloadDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestSurveyTokenDto,
  ) {
    return this.submitService.requestToken(
      id,
      {
        id: user.sub,
        email: user.email,
        language: user.language,
        theme: user.theme,
      },
      {
        ballots: dto.ballots ?? [],
        isPractice: dto.isPractice,
      },
    );
  }

  @Get(':id/confirm-survey')
  @Public()
  async confirmSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string,
    @Query('lang') lang: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const result = await this.submitService.confirmSurveyFromEmail(id, token);

    const finalTheme = theme ?? 'light';
    const finalLang = lang ?? 'en';

    // result.message may be an Error object (re-thrown from catch); coerce to
    // a plain string so the HTML template always receives a safe value.
    const errorMessage =
      result.message instanceof Error
        ? result.message.message
        : String(result.message ?? 'Verification failed.');

    const html = result.success
      ? this.successHtml(
          result.receipts ?? [],
          finalTheme as 'light' | 'dark',
          finalLang,
        )
      : this.errorHtml(errorMessage, finalTheme as 'light' | 'dark', finalLang);

    res.status(HttpStatus.OK).type('text/html').send(html);
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

  private successHtml(
    receipts: string[],
    theme: 'light' | 'dark' = 'light',
    language: string = 'en',
  ): string {
    const isDark = theme === 'dark';
    const labels = this.getLabels(language);

    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${labels.successTitle}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: ${isDark ? '#111827' : '#f9fafb'};
    }
    .card {
      background: ${isDark ? '#1f2937' : 'white'};
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 520px;
      width: 90%;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,${isDark ? '0.4' : '0.1'}), 0 2px 4px -1px rgba(0,0,0,0.06);
      text-align: center;
    }
    .icon { font-size: 3.5rem; margin-bottom: 1.5rem; }
    h1 { color: ${isDark ? '#34d399' : '#059669'}; margin: 0 0 0.75rem; font-size: 1.75rem; }
    p { color: ${isDark ? '#9ca3af' : '#4b5563'}; margin: 0 0 2rem; line-height: 1.5; }
    .receipt-container { margin-top: 1.5rem; }
    .receipt {
      background: ${isDark ? '#111827' : '#f3f4f6'};
      border: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
      border-radius: 8px;
      padding: 1rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      word-break: break-all;
      text-align: left;
      margin-bottom: 0.5rem;
      color: ${isDark ? '#e5e7eb' : '#111827'};
    }
    .label {
      font-size: 11px;
      font-weight: 700;
      color: ${isDark ? '#6b7280' : '#6b7280'};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
      text-align: left;
    }
    .btn {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.75rem 1.5rem;
      background: #059669;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover { background: #047857; }
    .footer {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid ${isDark ? '#374151' : '#f3f4f6'};
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>${labels.successHeading}</h1>
    <p>${labels.successBody}</p>
    <div class="receipt-container">
      <div class="label">${labels.receiptsLabel}</div>
      ${receipts.map((r) => `<div class="receipt">${r}</div>`).join('')}
    </div>
    <button class="btn" onclick="downloadReceipt()">${labels.downloadBtn}</button>
    <div class="footer">
      ${labels.successFooter}
    </div>
  </div>
  <script>
    function downloadReceipt() {
      const data = {
        submittedAt: new Date().toISOString(),
        receipts: ${JSON.stringify(receipts)},
        disclaimer: "This is a cryptographic proof of your survey response. Keep it secure and private."
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'survey-receipt-' + new Date().getTime() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
`;
  }

  private errorHtml(
    message: string,
    theme: 'light' | 'dark' = 'light',
    language: string = 'en',
  ): string {
    const isDark = theme === 'dark';
    const labels = this.getLabels(language);

    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${labels.errorTitle}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: ${isDark ? '#1f0a0a' : '#fef2f2'};
    }
    .card {
      background: ${isDark ? '#1f2937' : 'white'};
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,${isDark ? '0.4' : '0.1'});
      text-align: center;
      border: 1px solid ${isDark ? '#7f1d1d' : '#fee2e2'};
    }
    .icon { font-size: 3.5rem; margin-bottom: 1.5rem; }
    h1 { color: ${isDark ? '#f87171' : '#dc2626'}; margin: 0 0 1rem; font-size: 1.75rem; }
    p { color: ${isDark ? '#9ca3af' : '#4b5563'}; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>${labels.errorHeading}</h1>
    <p>${message}</p>
    <div style="margin-top: 2rem;">
      <p style="font-size: 14px; color: ${isDark ? '#6b7280' : '#6b7280'}; margin-bottom: 1rem;">
        ${labels.errorHint}
      </p>
    </div>
  </div>
</body>
</html>
`;
  }

  private getLabels(language: string): Record<string, string> {
    const translations: Record<string, Record<string, string>> = {
      en: {
        successTitle: 'Response Confirmed',
        successHeading: 'Response Confirmed',
        successBody:
          'Your survey responses have been securely recorded and added to the public audit chain.',
        receiptsLabel: 'Digital Ballot Receipts',
        downloadBtn: 'Download Receipt (JSON)',
        successFooter:
          'A copy has been sent to your email.<br/>You can safely close this window now.',
        errorTitle: 'Submission Failed',
        errorHeading: 'Verification Failed',
        errorHint:
          'Please return to the survey page and try requesting a new token.',
      },
      uk: {
        successTitle: 'Відповідь підтверджено',
        successHeading: 'Відповідь підтверджено',
        successBody:
          'Ваші відповіді на опитування надійно зафіксовано та додано до публічного ланцюжка аудиту.',
        receiptsLabel: 'Цифрові квитанції бюлетеня',
        downloadBtn: 'Завантажити квитанцію (JSON)',
        successFooter:
          'Копію надіслано на вашу електронну пошту.<br/>Це вікно можна закрити.',
        errorTitle: 'Помилка подання',
        errorHeading: 'Перевірка не пройдена',
        errorHint:
          'Поверніться на сторінку опитування та запросіть новий токен.',
      },
    };

    return translations[language] ?? translations['en'];
  }
}

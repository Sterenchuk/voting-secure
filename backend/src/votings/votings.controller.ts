import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { VotingsService } from './votings.service';
import { VoteService } from './vote.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';
import { VotingCreateDto } from './dto/voting.create.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';
import { FindVotingQueryDto } from './dto/find.voting.query.dto';
import { CastVoteDto } from './dto/cast.vote.dto';
import { RequestTokenDto } from './dto/request-token.dto';
import { Audit, ChainAction } from '../audit/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuditVerifyGuard } from '../audit/audit-verify.guard';
import { VerifyResult } from '../audit/types/audit.types';
import { AuditService } from '../audit/audit.service';
import { UserPayloadDto } from '../auth/dto/payload.dto';

@UseGuards(JwtAuthGuard)
@Controller('votings')
export class VotingsController {
  constructor(
    private readonly votingsService: VotingsService,
    private readonly voteService: VoteService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Voting CRUD ──────────────────────────────────────────────────────────────

  @Post()
  @Audit({
    action: ChainAction.VOTING_CREATED,
    extractPayload: (res: any) => ({
      votingId: res.id,
      title: res.title,
    }),
  })
  create(@Body() dto: VotingCreateDto, @CurrentUser() user: UserPayloadDto) {
    return this.votingsService.create(user.sub, dto);
  }

  @Get()
  findAll(
    @Query() dto: FindVotingQueryDto,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.votingsService.findAll(dto, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayloadDto) {
    return this.votingsService.findOne(id, user.sub);
  }

  @Patch(':id')
  @Audit({
    action: ChainAction.VOTING_UPDATED,
    extractPayload: (res: any) => ({
      votingId: res.id,
      updatedFields: res,
    }),
  })
  update(
    @Param('id') id: string,
    @Body() dto: VotingUpdateDto,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.votingsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Audit({
    action: ChainAction.VOTING_DELETED,
    extractPayload: (_res: any, req: any) => ({
      votingId: req.params.id,
    }),
  })
  delete(@Param('id') id: string, @CurrentUser() user: UserPayloadDto) {
    return this.votingsService.delete(id, user.sub);
  }

  // ─── Token ────────────────────────────────────────────────────────────────────

  /**
   * POST /votings/:id/token
   * Issues a single-use voting token sent to the user's email.
   * Rec(2004)11 §47 — decouples authentication from ballot casting.
   */
  @Post(':id/token')
  requestToken(
    @Param('id') votingId: string,
    @Body() dto: RequestTokenDto,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.voteService.requestToken(
      votingId,
      {
        id: user.sub,
        email: user.email,
        language: user.language,
        theme: user.theme,
      },
      {
        optionIds: dto.optionIds,
        otherText: dto.otherText,
      },
    );
  }

  // ─── Vote casting ─────────────────────────────────────────────────────────────

  /**
   * GET /votings/:id/confirm-vote?token=...
   * Endpoint for email link confirmation.
   */
  @Get(':id/confirm-vote')
  @Public()
  async confirmVote(
    @Param('id') votingId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const result = await this.voteService.confirmVoteFromEmail(votingId, token);

    const theme = result?.theme ?? 'light';
    const language = result?.language ?? 'en';

    console.log(
      `Vote confirmation result for voting ${votingId}:`,
      result.language,
      result.theme,
      result.success,
      result.message,
      result.receipts,
    );
    const html = result.success
      ? this.successHtml(
          result.receipts ?? [],
          theme as 'light' | 'dark',
          language,
        )
      : this.errorHtml(
          result.message ?? 'Verification failed.',
          theme as 'light' | 'dark',
          language,
        );

    res.status(HttpStatus.OK).type('text/html').send(html);
  }

  /**
   * POST /votings/:id/vote
   * Casts a vote. Requires the raw token string from email.
   * BALLOT_CAST is audited directly inside VoteService — NOT via decorator.
   * Reason: requires null userId (§26), receipts, and chain context
   * that are only available inside the service transaction scope.
   */
  @Post(':id/vote')
  vote(
    @Param('id') votingId: string,
    @Body() dto: CastVoteDto,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.voteService.vote(
      votingId,
      dto.ballots,
      {
        id: user.sub,
        email: user.email,
        language: user.language,
        theme: user.theme,
      },
      dto.token,
      dto.otherText,
    );
  }

  // ─── Results ──────────────────────────────────────────────────────────────────

  /**
   * GET /votings/:id/results
   * Live aggregated results — visible to everyone.
   */
  @Get(':id/results')
  getResults(@Param('id') votingId: string) {
    return this.voteService.getResults(votingId);
  }

  /**
   * GET /votings/:id/results/admin
   * Live results including dynamic (other) option breakdown.
   * Restricted to ADMIN and AUDITOR.
   */
  @Get(':id/results/admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AUDITOR)
  getAdminResults(@Param('id') votingId: string) {
    return this.voteService.getResults(votingId, true);
  }

  /**
   * GET /votings/:id/results/sealed
   * Immutable sealed tally — only available after finalization (Rec §56).
   */
  @Get(':id/results/sealed')
  getSealedResult(@Param('id') votingId: string) {
    return this.voteService.getSealedResult(votingId);
  }

  // ─── Finalization ─────────────────────────────────────────────────────────────

  /**
   * POST /votings/:id/finalize
   * Seals results into an immutable VotingResult row.
   * Restricted to ADMIN.
   */
  @Post(':id/finalize')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  finalize(@Param('id') votingId: string, @CurrentUser() user: UserPayloadDto) {
    return this.voteService.finalizeVoting(votingId, user.sub);
  }

  // ─── User participation status ────────────────────────────────────────────────

  /**
   * GET /votings/:id/my-vote
   * Returns whether the user has voted — never what they voted.
   * Rec(2004)11: choices must never be revealed after the fact.
   */
  @Get(':id/my-vote')
  getUserVote(
    @Param('id') votingId: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.voteService.getUserVote(votingId, user.sub);
  }

  // ─── Receipt/Chain verification ────────────────────────────────────────────────────────

  @Get(':id/verify-receipt')
  @Public()
  verifyReceipt(
    @Param('id') votingId: string,
    @Query('hash') hash: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.voteService.verifyReceipt(votingId, hash);
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
    <div class="footer">
      ${labels.successFooter}
    </div>
  </div>
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
    .btn {
      display: inline-block;
      background: ${isDark ? '#e5e7eb' : '#111827'};
      color: ${isDark ? '#111827' : 'white'};
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
    }
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
        successTitle: 'Vote Confirmed',
        successHeading: 'Vote Confirmed',
        successBody:
          'Your choices have been securely recorded and added to the public audit chain.',
        receiptsLabel: 'Digital Ballot Receipts',
        successFooter:
          'A copy has been sent to your email.<br/>You can safely close this window now.',
        errorTitle: 'Vote Failed',
        errorHeading: 'Verification Failed',
        errorHint:
          'Please return to the voting page and try requesting a new token.',
      },
      uk: {
        successTitle: 'Голос підтверджено',
        successHeading: 'Голос підтверджено',
        successBody:
          'Ваші вибори надійно зафіксовано та додано до публічного ланцюжка аудиту.',
        receiptsLabel: 'Цифрові квитанції бюлетеня',
        successFooter:
          'Копію надіслано на вашу електронну пошту.<br/>Це вікно можна закрити.',
        errorTitle: 'Помилка голосування',
        errorHeading: 'Перевірка не пройдена',
        errorHint:
          'Поверніться на сторінку голосування та запросіть новий токен.',
      },
      // add more locales as needed
    };

    return translations[language] ?? translations['en'];
  }
}

// src/audit/interceptors/audit.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

import { AuditService } from './audit.service';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { ChainAction, SecurityAction } from './types/audit.types';

function userIdFromCookie(req: Request, jwtService: JwtService): string | null {
  try {
    const token =
      req.signedCookies?.['access_token'] ??
      req.cookies?.['access_token'] ??
      null;

    if (!token) return null;

    const payload = jwtService.decode(token) as Record<string, unknown> | null;
    return (payload?.sub as string) ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      // tap() does NOT support async callbacks — RxJS won't await them and
      // any thrown promise rejection propagates upstream crashing the response.
      // void + .catch() fully detaches the audit write from the request lifecycle.
      tap({
        next: (response: unknown) => {
          void this.writeAudit(meta, response, req).catch(() => {
            // Audit failure must never affect the HTTP response.
          });
        },
      }),
    );
  }

  private async writeAudit(
    meta: AuditMeta,
    response: unknown,
    req: Request,
  ): Promise<void> {
    const { action, extractPayload } = meta;

    const payload: Record<string, unknown> = extractPayload
      ? extractPayload(response, req)
      : {};

    const userId = userIdFromCookie(req, this.jwtService);

    // ── Security tier ──────────────────────────────────────────────────────
    if (Object.values(SecurityAction).includes(action as SecurityAction)) {
      await this.auditService.appendSecurity({
        action: action as SecurityAction,
        payload,
        userId,
      });
      return;
    }

    // ── Chain tier ─────────────────────────────────────────────────────────
    const chainAction = action as ChainAction;

    const isBallot =
      chainAction === ChainAction.BALLOT_CAST ||
      chainAction === ChainAction.SURVEY_BALLOT_CAST;

    const res = (response ?? {}) as Record<string, unknown>;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const params = (req.params ?? {}) as Record<string, string>;

    const groupId = (res.groupId ?? body.groupId ?? params.groupId ?? null) as
      | string
      | null;
    const votingId = (res.votingId ??
      body.votingId ??
      params.votingId ??
      null) as string | null;
    const surveyId = (res.surveyId ??
      body.surveyId ??
      params.surveyId ??
      null) as string | null;

    await this.auditService.appendChain({
      action: chainAction,
      payload,
      userId: isBallot ? null : userId,
      groupId,
      votingId,
      surveyId,
    });
  }
}

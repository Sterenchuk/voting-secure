import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Request } from 'express';

import { AuditService } from './audit.service';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { SecurityAction } from '../common/enums/audit.actions';
import { ChainAction } from './types/audit.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((response) => {
        // Capture necessary data before the request object potentially goes out of scope
        const action = meta.action;
        const extractPayload = meta.extractPayload;
        const currentUserId = (req as any).user?.sub ?? null;
        const ip = req.ip;
        const userAgent = req.headers['user-agent'];
        const params = { ...req.params };
        const body = { ...req.body };

        // Fire and forget audit write
        this.writeAuditAsync(
          action,
          extractPayload,
          response,
          currentUserId,
          ip,
          userAgent,
          params,
          body,
        ).catch((err) => {});

        return response;
      }),
    );
  }

  private async writeAuditAsync(
    action: string,
    extractPayload: any,
    response: unknown,
    currentUserId: string | null,
    ip: string | undefined,
    userAgent: string | undefined,
    params: any,
    body: any,
  ): Promise<void> {
    const payload = extractPayload
      ? extractPayload(response, { params, body })
      : {};

    if (Object.values(SecurityAction).includes(action as any)) {
      await this.auditService.appendSecurity({
        action: action as SecurityAction,
        payload,
        userId: currentUserId,
        ip,
        userAgent,
      } as any);
      return;
    }

    // ANONYMITY POLICY: userId MUST be null for ballot casting actions
    const isAnonymous =
      action === ChainAction.BALLOT_CAST ||
      action === ChainAction.SURVEY_BALLOT_CAST;

    const auditUserId = isAnonymous ? null : currentUserId;

    const res = (response ?? {}) as Record<string, any>;

    await this.auditService.appendChain({
      action: action as any,
      payload,
      userId: auditUserId,
      groupId: res.groupId ?? params.groupId ?? body.groupId ?? null,
      votingId: res.votingId ?? params.id ?? body.votingId ?? null,
      surveyId: res.surveyId ?? params.id ?? body.surveyId ?? null,
    });
  }
}

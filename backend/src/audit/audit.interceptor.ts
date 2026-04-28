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

    return next
      .handle()
      .pipe(
        switchMap((response) =>
          from(this.writeAudit(meta, response, req)).pipe(map(() => response)),
        ),
      );
  }

  private async writeAudit(
    meta: AuditMeta,
    response: unknown,
    req: any,
  ): Promise<void> {
    const { action, extractPayload } = meta;
    const payload = extractPayload ? extractPayload(response, req) : {};
    const userId = req.user?.sub ?? null;

    if (Object.values(SecurityAction).includes(action as any)) {
      await this.auditService.appendSecurity({
        action: action as SecurityAction,
        payload,
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      } as any);
      return;
    }

    const res = (response ?? {}) as Record<string, any>;
    const params = req.params ?? {};
    const body = req.body ?? {};

    await this.auditService.appendChain({
      action: action as any,
      payload,
      groupId: res.groupId ?? params.groupId ?? body.groupId ?? null,
      votingId: res.votingId ?? params.id ?? body.votingId ?? null,
      surveyId: res.surveyId ?? params.id ?? body.surveyId ?? null,
    });
  }
}

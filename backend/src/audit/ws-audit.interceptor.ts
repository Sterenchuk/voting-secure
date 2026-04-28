import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { AuditService } from './audit.service';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { SecurityAction } from '../common/enums/audit.actions';
import { AuthenticatedSocket } from '../auth/authenticated-socket.interface';

@Injectable()
export class WsAuditInterceptor implements NestInterceptor {
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

    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const data = context.switchToWs().getData();

    return next
      .handle()
      .pipe(
        switchMap((response) =>
          from(this.writeAudit(meta, response, client, data)).pipe(
            map(() => response),
          ),
        ),
      );
  }

  private async writeAudit(
    meta: AuditMeta,
    response: unknown,
    client: AuthenticatedSocket,
    data: any,
  ): Promise<void> {
    const { action, extractPayload } = meta;
    const payload = extractPayload ? extractPayload(response, data) : {};
    const userId = client.user?.id ?? null;

    if (Object.values(SecurityAction).includes(action as any)) {
      await this.auditService.appendSecurity({
        action: action as SecurityAction,
        payload,
        userId,
      } as any);
      return;
    }

    const res = (response ?? {}) as Record<string, any>;
    const body = (data ?? {}) as Record<string, any>;

    await this.auditService.appendChain({
      action: action as any,
      payload,
      groupId: res.groupId ?? body.groupId ?? null,
      votingId: res.votingId ?? body.votingId ?? null,
      surveyId: res.surveyId ?? body.surveyId ?? null,
    });
  }
}

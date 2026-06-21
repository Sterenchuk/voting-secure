import { SetMetadata } from '@nestjs/common';
import { AuditAction, ChainAction, SecurityAction } from './types/audit.types';

export const AUDIT_KEY = 'audit_metadata';

export interface AuditMeta {
  action: AuditAction;
  extractPayload?: (
    response: unknown,
    request: unknown,
  ) => Record<string, unknown>;
}

export function Audit(meta: AuditMeta) {
  return SetMetadata(AUDIT_KEY, meta);
}

export { ChainAction, SecurityAction };

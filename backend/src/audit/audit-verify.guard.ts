import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '../common/enums/role';
import { GroupRole } from '../common/enums/group-role';
import { UserPayloadDto } from '../auth/dto/payload.dto';

interface RequestUser extends UserPayloadDto {
  groupRoles?: Record<string, GroupRole>;
}

/**
 * Guards GET /audit/verify and GET /audit/verify/:groupId.
 * 
 * NOTE: For :groupId routes, this should be used AFTER GroupRoleGuard
 * which populates the user.groupRoles object.
 *
 * Access rules:
 *   • Platform ADMIN or AUDITOR → full chain, any groupId or none.
 *   • Group OWNER or ADMIN → only their own groupId (must match :groupId param).
 *   • Everyone else → 403.
 */
@Injectable()
export class AuditVerifyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    const groupId = req.params?.groupId ?? null;

    if (!user) throw new ForbiddenException('Unauthenticated');

    // Platform admin or Auditor — full access.
    if (user.role === Role.ADMIN || user.role === Role.AUDITOR) return true;

    // Group-scoped access — must supply a groupId and hold OWNER or ADMIN there.
    if (groupId && typeof groupId === 'string') {
      const groupRole = user.groupRoles?.[groupId];
      if (groupRole === GroupRole.OWNER || groupRole === GroupRole.ADMIN) {
        return true;
      }
    }

    throw new ForbiddenException(
      'Access denied. Platform ADMIN or group OWNER/ADMIN required.',
    );
  }
}

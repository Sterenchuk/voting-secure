import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { GROUP_ROLES_KEY } from '../decorators/group-roles.decorator';
import { STRICT_GROUP_CHECK_KEY } from '../decorators/strict-group-check.decorator';
import { GroupRole } from '../enums/group-role';
import { Role } from '../enums/role';

@Injectable()
export class GroupRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<GroupRole[]>(
      GROUP_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isStrict = this.reflector.getAllAndOverride<boolean>(
      STRICT_GROUP_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Unauthenticated');

    // Platform ADMIN bypasses group checks UNLESS it's a strict check
    if (user.role === Role.ADMIN && !isStrict) {
      return true;
    }

    // AUDITOR bypasses group checks for GET requests UNLESS it's a strict check
    if (user.role === Role.AUDITOR && request.method === 'GET' && !isStrict) {
      return true;
    }

    // Try to find groupId in params
    let groupId = request.params.groupId || request.params.id;

    // If it's a voting route, we might need to find the groupId from the voting
    if (!groupId && (request.params.votingId || request.params.id) && request.url.includes('votings')) {
       const vId = request.params.votingId || request.params.id;
       const voting = await this.db.voting.findUnique({
         where: { id: vId },
         select: { groupId: true }
       });
       if (voting) groupId = voting.groupId;
    }

    // If it's a survey route, we might need to find the groupId from the survey
    if (!groupId && (request.params.surveyId || request.params.id) && request.url.includes('surveys')) {
      const sId = request.params.surveyId || request.params.id;
      const survey = await this.db.survey.findUnique({
        where: { id: sId },
        select: { groupId: true }
      });
      if (survey) groupId = survey.groupId;
    }

    if (!groupId) {
      if (requiredRoles && requiredRoles.length > 0) {
        throw new ForbiddenException('Group context required for this operation');
      }
      return true;
    }

    const membership = await this.db.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId: user.sub,
          groupId,
        },
      },
      select: { role: true },
    });

    // Enforce 404 Privacy Policy (Plan 6.2)
    if (!membership) {
      // If user is Platform Admin, they might not be a member but should still see if NOT strict
      if (user.role === Role.ADMIN && !isStrict) {
         return true;
      }
      throw new NotFoundException('Group or resource not found');
    }

    // Populate for later use (e.g. AuditVerifyGuard)
    if (!user.groupRoles) user.groupRoles = {};
    user.groupRoles[groupId] = membership.role;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = requiredRoles.includes(membership.role as GroupRole);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions within the group');
    }

    return true;
  }
}

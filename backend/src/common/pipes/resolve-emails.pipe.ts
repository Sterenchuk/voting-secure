import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ResolveEmailsPipe implements PipeTransform {
  constructor(private readonly database: DatabaseService) {}

  async transform(value: any, metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') return value;

    // Handle single email resolution (works for 'email' or 'userEmail' fields)
    const emailKey = value.email ? 'email' : value.userEmail ? 'userEmail' : null;
    
    if (emailKey) {
      const emailValue = value[emailKey];
      const user = await this.database.user.findUnique({
        where: { email: emailValue },
        select: { id: true },
      });

      // For login/register, we might not find the user yet, so we don't ALWAYS throw.
      // But for Group actions (ChangeRole), we usually want to throw.
      // Strategy: Attach the ID if found. The controller/service handles the "not found" logic.
      if (user) {
        value.targetUserId = user.id;
      }
    }

    // Handle array of emails resolution
    if (value.userEmails && Array.isArray(value.userEmails)) {
      if (value.userEmails.length === 0) return value;

      const users = await this.database.user.findMany({
        where: { email: { in: value.userEmails } },
        select: { id: true, email: true },
      });

      if (users.length !== value.userEmails.length) {
        const foundEmails = users.map((u) => u.email);
        const missingEmails = value.userEmails.filter(
          (e) => !foundEmails.includes(e),
        );
        throw new NotFoundException(
          `Users not found: ${missingEmails.join(', ')}`,
        );
      }
      value.targetUserIds = users.map((u) => u.id);
    }

    return value;
  }
}

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CryptoUtils } from '../utils/crypto-utils';

@Injectable()
export class ResolveEmailsPipe implements PipeTransform {
  constructor(private readonly database: DatabaseService) {}

  async transform(value: any, metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') return value;

    // Handle single email resolution (works for 'email' or 'userEmail' fields)
    const emailKey = value.email ? 'email' : value.userEmail ? 'userEmail' : null;
    
    if (emailKey) {
      const emailValue = value[emailKey];
      const emailHash = CryptoUtils.getBlindIndex(emailValue);
      const user = await this.database.user.findUnique({
        where: { emailHash },
        select: { id: true },
      });

      if (user) {
        value.targetUserId = user.id;
      }
    }

    // Handle array of emails resolution
    if (value.userEmails && Array.isArray(value.userEmails)) {
      if (value.userEmails.length === 0) return value;

      const emailHashes = value.userEmails.map(e => CryptoUtils.getBlindIndex(e));
      const users = await this.database.user.findMany({
        where: { emailHash: { in: emailHashes } },
        select: { id: true, emailHash: true },
      });

      if (users.length !== value.userEmails.length) {
        const foundHashes = users.map((u) => u.emailHash);
        const missingEmails = value.userEmails.filter(
          (e) => !foundHashes.includes(CryptoUtils.getBlindIndex(e)),
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

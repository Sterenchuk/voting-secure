import * as crypto from 'crypto';

export class CryptoUtils {
  /**
   * Generates a SHA-256 hash of a string.
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generates a tally hash for a voting result (Rec §56).
   * Ensures the tally and total count are cryptographically linked.
   */
  static generateTallyHash(tally: any, totalBallots: number): string {
    const data = JSON.stringify(tally) + totalBallots.toString();
    return this.hash(data);
  }

  /**
   * Generates a random secure hex token.
   */
  static generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Hashes a token for storage (e.g., RefreshToken, VotingToken).
   */
  static hashToken(token: string): string {
    return this.hash(token);
  }
}

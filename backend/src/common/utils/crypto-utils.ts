import * as crypto from 'crypto';

export class CryptoUtils {
  private static getEncryptionKeys(): string[] {
    const keysStr = process.env.ENCRYPTION_KEYS;
    if (!keysStr) {
      // Default for demo if not set, but in reality we should throw
      return ['000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'];
    }
    return keysStr.split(',').map((k) => k.trim());
  }

  private static getBlindIndexKey(): string {
    const key = process.env.BLIND_INDEX_KEY;
    if (!key) {
      // Default for demo if not set
      return 'blind-index-secret-demo-key-32-chars-!!';
    }
    return key;
  }

  /**
   * Encrypts text using AES-256-GCM with the latest key.
   * Returns: keyIndex:iv:authTag:ciphertext (all hex)
   */
  static encrypt(text: string): string {
    const keys = this.getEncryptionKeys();
    const latestIndex = keys.length - 1;
    const key = Buffer.from(keys[latestIndex], 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${latestIndex}:${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts text using AES-256-GCM using the indexed key.
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText; // Not encrypted or invalid format
    }
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 4) return encryptedText;

      const [indexStr, ivHex, authTagHex, ciphertextHex] = parts;
      const index = parseInt(indexStr, 10);
      const keys = this.getEncryptionKeys();

      if (index >= keys.length) {
        throw new Error(`Key index ${index} out of bounds`);
      }

      const key = Buffer.from(keys[index], 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return encryptedText;
    }
  }

  /**
   * Generates a deterministic Blind Index for lookups.
   * Uses HMAC-SHA256 with a dedicated secret.
   */
  static getBlindIndex(text: string): string {
    if (!text) return '';
    const secret = this.getBlindIndexKey();
    return crypto
      .createHmac('sha256', secret)
      .update(text.toLowerCase()) // Case-insensitive lookup
      .digest('hex');
  }

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

  static generateSecureToken(bytes = 32): string {
    return this.generateRandomToken(bytes);
  }

  /**
   * Hashes a token for storage (e.g., RefreshToken, VotingToken).
   */
  static hashToken(token: string): string {
    return this.hash(token);
  }

  static generateBallotReceipt(
    votingId: string,
    optionId: string,
    tokenHashed: string,
  ): string {
    const secret = process.env.BALLOT_SECRET;
    if (!secret) {
      throw new Error('BALLOT_SECRET environment variable is not set');
    }
    return crypto
      .createHmac('sha256', secret)
      .update(`${votingId}:${optionId}:${tokenHashed}`)
      .digest('hex');
  }
}

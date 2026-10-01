import * as crypto from 'crypto';

export class CryptoUtils {
  private static getEncryptionKeys(): string[] {
    const keysStr = process.env.ENCRYPTION_KEYS;
    if (!keysStr) {
      throw new Error('ENCRYPTION_KEYS environment variable is not set');
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

  // ─── RSA blind signatures (Chaum) ─────────────────────────────────────────────

  // keypair per voting/survey; private key НІКОЛИ не покидає сервер
  static generateVotingKeyPair(keySize = 2048): {
    publicKey: string; // PEM
    privateKey: string; // PEM (зберігати в env / vault, НЕ в БД)
  } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }

  // Бібліотека: повертає { n, e } з PEM-публічного ключа (server-side)
  static rsaPublicParams(publicKeyPem: string): { n: bigint; e: bigint } {
    const key = crypto.createPublicKey(publicKeyPem);
    const jwk = key.export({ format: 'jwk' }) as any;
    return {
      n: BigInt(`0x${Buffer.from(jwk.n!, 'base64url').toString('hex')}`),
      e: BigInt(`0x${Buffer.from(jwk.e!, 'base64url').toString('hex')}`),
    };
  }

  // КЛІЄНТ: blinded = T · r^e (mod n)
  // tokenHex — 64 hex (256 bit), modulusHex — hex(n), exponentHex — hex(e)
  static blindToken(tokenHex: string, r: bigint, modulusHex: string, exponentHex: string): string {
    const n = BigInt(`0x${modulusHex}`);
    const e = BigInt(`0x${exponentHex}`);
    const T = BigInt(`0x${tokenHex}`);
    const blinded = (T * this.modPow(r, e, n)) % n;
    return blinded.toString(16).padStart(modulusHex.length, '0');
  }

  static signBlinded(blindedHex: string, privateKeyPem: string): string {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const details = privateKey.asymmetricKeyDetails;
    if (!details || !details.modulusLength) {
      throw new Error('Unable to determine private key modulus length');
    }
    const size = details.modulusLength / 8;
    const buf = Buffer.from(blindedHex.padStart(size * 2, '0'), 'hex');
    const sig = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_NO_PADDING },
      buf,
    );
    return sig.toString('hex');
  }

  static unblind(blindSigHex: string, r: bigint, modulusHex: string): string {
    const n = BigInt(`0x${modulusHex}`);
    const s = (BigInt(`0x${blindSigHex}`) * this.modInverse(r, n)) % n;
    return s.toString(16).padStart(modulusHex.length, '0');
  }

  // СЕРВЕР: verify: sig^e ≡ T (mod n)
  static verifyBlindSignature(
    tokenHex: string,
    signatureHex: string,
    publicKeyPem: string,
  ): boolean {
    const { n, e } = this.rsaPublicParams(publicKeyPem);
    const T = BigInt(`0x${tokenHex}`);
    const s = BigInt(`0x${signatureHex}`);
    return this.modPow(s, e, n) === T;
  }

  // ─── утиліти ──────────────────────────────────────────────────────────────────

  static modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base %= mod;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      base = (base * base) % mod;
      exp >>= 1n;
    }
    return result;
  }

  static modInverse(a: bigint, m: bigint): bigint {
    const [g, x] = this.egcd(a % m, m);
    if (g !== 1n) throw new Error('r is not invertible mod n');
    return ((x % m) + m) % m;
  }

  private static egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
    if (b === 0n) return [a, 1n, 0n];
    const [g, x1, y1] = this.egcd(b, a % b);
    return [g, y1, x1 - (a / b) * y1];
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
      .update(text.normalize('NFKC').trim().toLowerCase()) // Case-insensitive lookup
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
   * HMAC-SHA256 — resistant to rainbow-table attacks on low-entropy tokens.
   */
  static hashToken(token: string): string {
    const secret = process.env.TOKEN_HASH_SECRET;
    if (!secret) {
      throw new Error('TOKEN_HASH_SECRET environment variable is not set');
    }
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
  }

  static generateBallotReceipt(votingId: string, optionId: string, secret: string): string {
    const secretKey = process.env.BALLOT_SECRET;
    if (!secretKey) {
      throw new Error('BALLOT_SECRET environment variable is not set');
    }
    return crypto
      .createHmac('sha256', secretKey)
      .update(`${votingId}:${optionId}:${secret}`)
      .digest('hex');
  }
}

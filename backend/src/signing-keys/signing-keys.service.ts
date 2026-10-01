import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CryptoUtils } from '../common/utils/crypto-utils';

export interface SigningKeyInfo {
  publicKey: string;
  modulusHex: string;
  exponentHex: string;
  keySize: number;
}

export interface SigningKeyWithPrivate extends SigningKeyInfo {
  privateKey: string;
}

/**
 * Get-or-create RSA keypairs per voting/survey for blind signatures.
 *
 * Public key is stored in Postgres (VotingSigningKey) so any replica can
 * verify a signature. The private key NEVER leaves the server: it is stored
 * in an env var (`VOTING_PRIVATE_KEY_<entityId>`) — provisioned at startup
 * or vault-backed in production.
 */
@Injectable()
export class SigningKeysService {
  private readonly logger = new Logger(SigningKeysService.name);

  constructor(private readonly db: DatabaseService) {}

  private get keySize(): number {
    const raw = process.env.VOTING_RSA_KEY_SIZE;
    const parsed = raw ? parseInt(raw, 10) : 2048;
    return parsed >= 1024 ? parsed : 2048;
  }

  private privateKeyEnvKey(entityId: string): string {
    return `VOTING_PRIVATE_KEY_${entityId}`;
  }

  private storePrivateKey(entityId: string, privateKey: string): void {
    process.env[this.privateKeyEnvKey(entityId)] = privateKey;
  }

  private getPrivateKey(entityId: string): string {
    const pk = process.env[this.privateKeyEnvKey(entityId)];
    if (!pk) {
      throw new Error(
        `Private signing key for entity ${entityId} is not available`,
      );
    }
    return pk;
  }

  private toInfo(publicKey: string): SigningKeyInfo {
    const { n, e } = CryptoUtils.rsaPublicParams(publicKey);
    return {
      publicKey,
      modulusHex: n.toString(16),
      exponentHex: e.toString(16),
      keySize: this.keySize,
    };
  }

  async ensureVotingKey(votingId: string): Promise<SigningKeyWithPrivate> {
    const existing = await this.db.votingSigningKey.findUnique({
      where: { votingId },
    });
    if (existing) {
      return { ...this.toInfo(existing.publicKey), privateKey: this.getPrivateKey(votingId) };
    }

    const { publicKey, privateKey } = CryptoUtils.generateVotingKeyPair(
      this.keySize,
    );
    this.storePrivateKey(votingId, privateKey);
    await this.db.votingSigningKey.create({ data: { votingId, publicKey } });
    this.logger.log(`Generated voting signing key for ${votingId}`);
    return { ...this.toInfo(publicKey), privateKey };
  }

  async ensureSurveyKey(surveyId: string): Promise<SigningKeyWithPrivate> {
    const existing = await this.db.votingSigningKey.findUnique({
      where: { surveyId },
    });
    if (existing) {
      return { ...this.toInfo(existing.publicKey), privateKey: this.getPrivateKey(surveyId) };
    }

    const { publicKey, privateKey } = CryptoUtils.generateVotingKeyPair(
      this.keySize,
    );
    this.storePrivateKey(surveyId, privateKey);
    await this.db.votingSigningKey.create({ data: { surveyId, publicKey } });
    this.logger.log(`Generated survey signing key for ${surveyId}`);
    return { ...this.toInfo(publicKey), privateKey };
  }

  async getVotingKey(votingId: string): Promise<SigningKeyInfo> {
    const row = await this.db.votingSigningKey.findUnique({
      where: { votingId },
    });
    if (!row) throw new NotFoundException('Signing key not found for voting');
    return this.toInfo(row.publicKey);
  }

  async getSurveyKey(surveyId: string): Promise<SigningKeyInfo> {
    const row = await this.db.votingSigningKey.findUnique({
      where: { surveyId },
    });
    if (!row) throw new NotFoundException('Signing key not found for survey');
    return this.toInfo(row.publicKey);
  }

  async getVotingPrivateKey(votingId: string): Promise<string> {
    return this.getPrivateKey(votingId);
  }

  async getSurveyPrivateKey(surveyId: string): Promise<string> {
    return this.getPrivateKey(surveyId);
  }
}

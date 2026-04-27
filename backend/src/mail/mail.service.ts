import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.getOrThrow<number>('MAIL_PORT'),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Verify your email',
      html: `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email:</p>
        <a href="${url}">Verify Email</a>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Reset your password',
      html: `
        <h1>Password Reset</h1>
        <p>Please click the link below to reset your password:</p>
        <a href="${url}">Reset Password</a>
      `,
    });
  }

  async sendVotingToken(
    email: string,
    token: string,
    votingTitle: string,
    votingId: string,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const voteUrl = `${frontendUrl}/votings/${votingId}?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: `Your voting token — ${votingTitle}`,
      html: `
      <h1>You are invited to vote</h1>
      <p><strong>${votingTitle}</strong></p>
      <p>Click the link below to cast your vote:</p>
      <a href="${voteUrl}" style="
        display:inline-block;
        padding:12px 24px;
        background:#1a1a1a;
        color:#fff;
        border-radius:6px;
        text-decoration:none;
      ">
        Cast My Vote
      </a>
      <p>Or use this token manually:</p>
      <code style="
        display:block;
        padding:10px;
        background:#f5f5f5;
        border-radius:4px;
        font-size:14px;
        margin:8px 0;
      ">${token}</code>
      <p style="color:#666;font-size:12px">
        This token expires in 1 hour and can only be used once.
      </p>
    `,
    });
  }

  async sendSurveyToken(email: string, token: string, surveyTitle: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/surveys/proof?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: `Your survey token for: ${surveyTitle}`,
      html: `
        <h1>Survey Token</h1>
        <p>You have requested a token to participate in: <strong>${surveyTitle}</strong>.</p>
        <p>Your token: <code>${token}</code></p>
        <p>Keep this for your records.</p>
      `,
    });
  }

  async sendVoteReceipt(
    email: string,
    votingTitle: string,
    votingId: string,
    receipts: string[],
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/votings/${votingId}/verify`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: `Your vote receipt — ${votingTitle}`,
      html: `
      <h1>Vote Confirmed</h1>
      <p>You successfully voted in: <strong>${votingTitle}</strong></p>

      <h2>Your Ballot Receipts</h2>
      <p>
        These are your cryptographic proofs. Each hash proves
        a specific ballot was cast and recorded in the public
        audit chain. Keep this email.
      </p>

      ${receipts
        .map(
          (r, i) => `
        <div style="margin:8px 0">
          <strong>Ballot ${i + 1}:</strong><br/>
          <code style="
            display:block;
            padding:10px;
            background:#f5f5f5;
            border-radius:4px;
            word-break:break-all;
            font-size:12px;
          ">${r}</code>
        </div>
      `,
        )
        .join('')}

      <h2>Verify Your Vote</h2>
      <p>
        You can verify your vote was counted by checking
        your receipt against the public audit chain:
      </p>
      <a
        href="${verifyUrl}"
        style="
          display:inline-block;
          padding:12px 24px;
          background:#1a1a1a;
          color:#fff;
          border-radius:6px;
          text-decoration:none;
          margin:8px 0;
        "
      >
        Verify My Vote
      </a>

      <p style="color:#666;font-size:12px;margin-top:24px">
        This receipt was generated at the moment of voting.
        The hashes are HMAC-SHA256 signatures tied to your
        specific ballot and cannot be forged.
      </p>
    `,
    });
  }
}

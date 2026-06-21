import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { mailTranslations, MailLanguage } from './mail-translations';

@Injectable()
@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    super();

    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.getOrThrow<number>('MAIL_PORT');
    const secure = this.configService.get<string>('MAIL_SECURE') === 'true';
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing mail job: ${job.id} (${job.name})`);

    switch (job.name) {
      case 'verification':
        return this.sendVerificationEmail(job.data);
      case 'password-reset':
        return this.sendPasswordResetEmail(job.data);
      case 'voting-token':
        return this.sendVotingToken(job.data);
      case 'survey-token':
        return this.sendSurveyToken(job.data);
      case 'vote-receipt':
        return this.sendVoteReceipt(job.data);
      default:
        this.logger.warn(`No handler for mail job: ${job.name}`);
        return { success: false, message: 'No handler for this job type' };
    }
  }

  private getThemeStyles(theme: string) {
    const isDark = theme === 'dark';
    return {
      container: `
        font-family: sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid ${isDark ? '#333' : '#eee'};
        border-radius: 10px;
        background-color: ${isDark ? '#121212' : '#ffffff'};
        color: ${isDark ? '#e0e0e0' : '#111111'};
      `,
      title: `color: ${isDark ? '#ffffff' : '#111'}; font-size: 24px; margin-top: 0;`,
      text: `color: ${isDark ? '#cccccc' : '#444'}; font-size: 16px; line-height: 1.5;`,
      muted: `color: ${isDark ? '#888' : '#666'}; font-size: 14px; border-top: 1px solid ${isDark ? '#333' : '#eee'}; padding-top: 20px;`,
      small: `color: ${isDark ? '#666' : '#999'}; font-size: 12px; margin-top: 10px;`,
      button: `
        display: inline-block;
        padding: 14px 28px;
        background: #059669;
        color: #ffffff;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        font-size: 16px;
      `,
      code: `
        display: block;
        padding: 10px;
        background: ${isDark ? '#1e1e1e' : '#f5f5f5'};
        color: ${isDark ? '#34d399' : '#059669'};
        border-radius: 4px;
        word-break: break-all;
        font-size: 12px;
        font-family: monospace;
      `,
    };
  }

  private getTranslations(lang: string = 'en') {
    return mailTranslations[lang as MailLanguage] || mailTranslations.en;
  }

  private async sendVerificationEmail({
    email,
    token,
    lang = 'en',
    theme = 'light',
  }: {
    email: string;
    token: string;
    lang?: string;
    theme?: string;
  }) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/verify-email?token=${token}`;
    const t = this.getTranslations(lang).verification;
    const s = this.getThemeStyles(theme);

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: t.subject,
      html: `
        <div style="${s.container}">
          <h1 style="${s.title}">${t.title}</h1>
          <p style="${s.text}">${t.text}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="${s.button}">${t.button}</a>
          </div>
        </div>
      `,
    });
  }

  private async sendPasswordResetEmail({
    email,
    token,
    lang = 'en',
    theme = 'light',
  }: {
    email: string;
    token: string;
    lang?: string;
    theme?: string;
  }) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/reset-password?token=${token}`;
    const t = this.getTranslations(lang).passwordReset;
    const s = this.getThemeStyles(theme);

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: t.subject,
      html: `
        <div style="${s.container}">
          <h1 style="${s.title}">${t.title}</h1>
          <p style="${s.text}">${t.text}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="${s.button}">${t.button}</a>
          </div>
        </div>
      `,
    });
  }

  private async sendVotingToken({
    email,
    token,
    votingTitle,
    votingId,
    lang = 'en',
    theme = 'light',
  }: {
    email: string;
    token: string;
    votingTitle: string;
    votingId: string;
    lang?: string;
    theme?: string;
  }) {
    this.logger.log(
      `Sending voting token email to ${lang} ${theme} for voting ${votingId}`,
    );
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3001';
    const confirmUrl = `${backendUrl}/votings/${votingId}/confirm-vote?token=${token}&lang=${lang}&theme=${theme}`;
    const t = this.getTranslations(lang).votingToken;
    const s = this.getThemeStyles(theme);

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: t.subject.replace('{title}', votingTitle),
      html: `
      <div style="${s.container}">
        <h1 style="${s.title}">${t.title}</h1>
        <p style="${s.text}">
          ${t.text1.replace('{title}', votingTitle)}
        </p>
        <p style="${s.text}">
          ${t.text2}
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" style="${s.button}">
            ${t.button}
          </a>
        </div>

        <p style="${s.muted}">
          ${t.securityNote}
        </p>

        <p style="${s.small}">
          ${t.trouble}<br/>
          <span style="word-break: break-all; color: #059669;">${confirmUrl}</span>
        </p>
      </div>
    `,
    });
  }

  private async sendSurveyToken({
    email,
    token,
    surveyTitle,
    surveyId,
    lang = 'en',
    theme = 'light',
  }: {
    email: string;
    token: string;
    surveyTitle: string;
    surveyId: string;
    lang?: string;
    theme?: string;
  }) {
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3001';
    const confirmUrl = `${backendUrl}/surveys/${surveyId}/confirm-survey?token=${token}&lang=${lang}&theme=${theme}`;
    const t = this.getTranslations(lang).surveyToken;
    const s = this.getThemeStyles(theme);

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: t.subject.replace('{title}', surveyTitle),
      html: `
      <div style="${s.container}">
        <h1 style="${s.title}">${t.title}</h1>
        <p style="${s.text}">
          ${t.text.replace('{title}', surveyTitle)}
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" style="${s.button}">
            ${t.button}
          </a>
        </div>

        <p style="${s.muted}">
          ${t.securityNote}
        </p>

        <p style="${s.small}">
          ${t.trouble}<br/>
          <span style="word-break: break-all; color: #059669;">${confirmUrl}</span>
        </p>
      </div>
    `,
    });
  }

  private async sendVoteReceipt({
    email,
    votingTitle,
    votingId,
    receipts,
    lang = 'en',
    theme = 'light',
  }: {
    email: string;
    votingTitle: string;
    votingId: string;
    receipts: string[];
    lang?: string;
    theme?: string;
  }) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/votings/${votingId}/verify`;
    const t = this.getTranslations(lang).voteReceipt;
    const s = this.getThemeStyles(theme);

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: t.subject.replace('{title}', votingTitle),
      html: `
      <div style="${s.container}">
        <h1 style="${s.title}">${t.title}</h1>
        <p style="${s.text}">${t.text.replace('{title}', votingTitle)}</p>

        <h2 style="${s.title}; font-size: 18px;">${t.subtitle}</h2>
        <p style="${s.text}; font-size: 14px;">
          ${t.description}
        </p>

        ${receipts
          .map(
            (r, i) => `
          <div style="margin:8px 0">
            <strong style="font-size: 14px;">${t.ballotLabel.replace('{index}', (i + 1).toString())}</strong><br/>
            <code style="${s.code}">${r}</code>
          </div>
        `,
          )
          .join('')}

        <h2 style="${s.title}; font-size: 18px; margin-top: 20px;">${t.verifyTitle}</h2>
        <p style="${s.text}; font-size: 14px;">
          ${t.verifyText}
        </p>
        <div style="text-align: center;">
          <a href="${verifyUrl}" style="${s.button}; padding: 12px 24px; font-size: 14px;">
            ${t.verifyButton}
          </a>
        </div>

        <p style="${s.small}; margin-top: 24px;">
          ${t.footer}
        </p>
      </div>
    `,
    });
  }
}

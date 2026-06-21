import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MailService {
  constructor(@InjectQueue('mail') private mailQueue: Queue) {}

  async sendVerificationEmail(
    email: string,
    token: string,
    lang: string = 'en',
    theme: string = 'light',
  ) {
    await this.mailQueue.add('verification', { email, token, lang, theme });
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    lang: string = 'en',
    theme: string = 'light',
  ) {
    await this.mailQueue.add('password-reset', { email, token, lang, theme });
  }

  async sendVotingToken(
    email: string,
    token: string,
    votingTitle: string,
    votingId: string,
    lang: string = 'en',
    theme: string = 'light',
  ) {
    await this.mailQueue.add('voting-token', {
      email,
      token,
      votingTitle,
      votingId,
      lang,
      theme,
    });
  }

  async sendSurveyToken(
    email: string,
    token: string,
    surveyTitle: string,
    surveyId: string,
    lang: string = 'en',
    theme: string = 'light',
  ) {
    await this.mailQueue.add('survey-token', {
      email,
      token,
      surveyTitle,
      surveyId,
      lang,
      theme,
    });
  }

  async sendVoteReceipt(
    email: string,
    votingTitle: string,
    votingId: string,
    receipts: string[],
    lang: string = 'en',
    theme: string = 'light',
  ) {
    await this.mailQueue.add('vote-receipt', {
      email,
      votingTitle,
      votingId,
      receipts,
      lang,
      theme,
    });
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailGateway, EmailMessage } from './email.gateway';

@Injectable()
export class SmtpEmailGateway implements EmailGateway, OnModuleInit {
  private readonly logger = new Logger(SmtpEmailGateway.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const portValue = config.get<string>('SMTP_PORT');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const configured = Boolean(host || portValue || user || pass);

    if (!configured) {
      this.from = null;
      this.transporter = null;
      this.logger.warn('SMTP is not configured; email delivery is disabled');
      return;
    }

    if (!host || !portValue || !user || !pass) {
      throw new Error(
        'SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS must be configured together',
      );
    }

    const port = Number(portValue);
    const secure = config.get<string>('SMTP_SECURE', 'false') === 'true';
    this.from = config.get<string>('EMAIL_FROM') ?? `Qolmasin <${user}>`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: port === 587,
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
    } catch (error) {
      this.logger.error(
        'SMTP connection verification failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter || !this.from) return;

    const result = (await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })) as { messageId?: string };

    this.logger.log(
      `Email accepted by SMTP: messageId=${result.messageId ?? 'unknown'}`,
    );
  }
}

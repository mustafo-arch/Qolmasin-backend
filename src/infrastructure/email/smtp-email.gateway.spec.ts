import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { SmtpEmailGateway } from './smtp-email.gateway';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe('SmtpEmailGateway', () => {
  const createTransport = nodemailer.createTransport as jest.Mock;

  beforeEach(() => {
    createTransport.mockReset();
  });

  it('configures Gmail port 587 with STARTTLS', async () => {
    const transporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'message-id' }),
    };
    createTransport.mockReturnValue(transporter);
    const gateway = new SmtpEmailGateway(
      new ConfigService({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'account@gmail.com',
        SMTP_PASS: 'app-password',
        EMAIL_FROM: 'Qolmasin <account@gmail.com>',
      }),
    );

    await gateway.onModuleInit();
    await gateway.send({
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test',
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: 'account@gmail.com', pass: 'app-password' },
      requireTLS: true,
    });
    expect(transporter.verify).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: 'Qolmasin <account@gmail.com>',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test',
      html: undefined,
    });
  });

  it('keeps email delivery disabled when SMTP is not configured', async () => {
    const gateway = new SmtpEmailGateway(new ConfigService());

    await gateway.onModuleInit();
    await gateway.send({
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test',
    });

    expect(createTransport).not.toHaveBeenCalled();
  });
});

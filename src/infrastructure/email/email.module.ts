import { Module } from '@nestjs/common';
import { EmailGateway } from './email.gateway';
import { SmtpEmailGateway } from './smtp-email.gateway';

@Module({
  providers: [{ provide: EmailGateway, useClass: SmtpEmailGateway }],
  exports: [EmailGateway],
})
export class EmailModule {}

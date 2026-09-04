export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export abstract class EmailGateway {
  abstract send(message: EmailMessage): Promise<void>;
}

import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version('1')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/health')
  @Version(VERSION_NEUTRAL)
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

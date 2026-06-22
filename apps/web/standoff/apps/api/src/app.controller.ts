import { Controller, Get } from '@nestjs/common';

/** Tiny health endpoint so Railway / uptime checks have something to hit. */
@Controller()
export class AppController {
  @Get()
  health(): { ok: boolean; service: string; ts: number } {
    return { ok: true, service: 'standoffduel-api', ts: Date.now() };
  }
}

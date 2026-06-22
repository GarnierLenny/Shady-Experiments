import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { DuelResultRecord } from '@standoffduel/shared';
import { ResultsStore } from './results.store';

/** Read API for shareable duel results, consumed by the /r/<id> permalink. */
@Controller('results')
export class ResultsController {
  constructor(private readonly store: ResultsStore) {}

  @Get(':id')
  async get(@Param('id') id: string): Promise<DuelResultRecord> {
    const record = await this.store.get(id);
    if (!record) throw new NotFoundException('result not found');
    return record;
  }
}

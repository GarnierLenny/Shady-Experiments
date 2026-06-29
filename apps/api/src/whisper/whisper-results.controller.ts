import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { WhisperResultRecord } from '@shadyexperiments/shared';
import { WhisperResultsStore } from './whisper-results.store';

/** Read API for shareable run results, consumed by the permalink page. */
@Controller('whisper-results')
export class WhisperResultsController {
  constructor(private readonly store: WhisperResultsStore) {}

  @Get(':id')
  async get(@Param('id') id: string): Promise<WhisperResultRecord> {
    const record = await this.store.get(id);
    if (!record) throw new NotFoundException('result not found');
    return record;
  }
}

import { Module } from '@nestjs/common';
import { WhisperGateway } from './whisper.gateway';
import { WhisperService } from './whisper.service';
import { WhisperResultsStore } from './whisper-results.store';
import { WhisperResultsController } from './whisper-results.controller';

@Module({
  controllers: [WhisperResultsController],
  providers: [WhisperGateway, WhisperService, WhisperResultsStore],
})
export class WhisperModule {}

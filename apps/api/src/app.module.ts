import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LobbyModule } from './lobby/lobby.module';
import { ResultsModule } from './results/results.module';
import { WhisperModule } from './whisper/whisper.module';

@Module({
  imports: [LobbyModule, ResultsModule, WhisperModule],
  controllers: [AppController],
})
export class AppModule {}

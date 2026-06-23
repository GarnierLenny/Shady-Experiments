import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LobbyModule } from './lobby/lobby.module';
import { ResultsModule } from './results/results.module';

@Module({
  imports: [LobbyModule, ResultsModule],
  controllers: [AppController],
})
export class AppModule {}

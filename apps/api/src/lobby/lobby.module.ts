import { Module } from '@nestjs/common';
import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { ResultsModule } from '../results/results.module';

@Module({
  imports: [ResultsModule],
  providers: [LobbyGateway, LobbyService],
})
export class LobbyModule {}

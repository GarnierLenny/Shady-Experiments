import { Module } from '@nestjs/common';
import { ResultsController } from './results.controller';
import { ResultsStore } from './results.store';

@Module({
  controllers: [ResultsController],
  providers: [ResultsStore],
  exports: [ResultsStore],
})
export class ResultsModule {}

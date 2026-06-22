import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_ORIGIN
      ? process.env.WEB_ORIGIN.split(',').map((o) => o.trim())
      : true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3002;
  await app.listen(port);
  new Logger('Bootstrap').log(`StandoffDuel API listening on :${port}`);
}

void bootstrap();

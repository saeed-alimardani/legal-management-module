import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONSTANTS, CONFIG_KEYS } from './config/constants';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix(APP_CONSTANTS.API_PREFIX, {
    exclude: ['health'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Legal Management Module')
    .setDescription('Internal legal operations API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(APP_CONSTANTS.SWAGGER_PATH, app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>(CONFIG_KEYS.PORT, 3000);

  await app.listen(port);
}

bootstrap();

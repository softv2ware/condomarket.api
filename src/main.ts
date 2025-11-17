import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('CondoMarket API')
    .setDescription('The CondoMarket API documentation')
    .setVersion('1.0')
    .addTag('condomarket')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Scalar API Reference
  app.use(
    '/reference',
    apiReference({
      spec: {
        content: document,
      },
    }),
  );

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`API Reference available at: http://localhost:${port}/reference`);
}
bootstrap();

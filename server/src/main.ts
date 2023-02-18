import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const SERVER_PORT = process.env?.SERVER_PORT ?? 4000

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MuseQueue')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(SERVER_PORT);
  console.log(`Server listening on: ${SERVER_PORT}`)
}
bootstrap();

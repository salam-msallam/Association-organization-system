import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { i18nValidationErrorFactory, I18nValidationExceptionFilter } from 'nestjs-i18n'; 

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Charity Management System API')
    .setDescription('توثيق خدمات نظام إدارة الجمعية الخيرية')
    .setVersion('1.0')
    .addBearerAuth() 
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); 

  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: i18nValidationErrorFactory,
    }),
  );

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, 
    transform: true, 
  }));
  app.useGlobalFilters(new I18nValidationExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

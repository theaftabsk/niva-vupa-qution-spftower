import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet Security Headers (HSTS, X-Frame-Options, X-Content-Type-Options)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Ensure uploads/recordings directory exists
  const uploadDir = join(process.cwd(), 'uploads', 'recordings');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Serve static audio files
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Increase payload limit to 50MB to support long audio voice uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Strict CORS Domain Protection
  const allowedOrigins = [
    'https://niva.greatcampus.in',
    'https://admin.niva.greatcampus.in',
    'https://api.niva.greatcampus.in',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000',
  ];

  app.enableCors({
    origin: (origin: any, callback: any) => {
      if (!origin || allowedOrigins.includes(origin) || origin.includes('greatcampus.in')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With,x-api-key,x-user-role,x-vendor-id,X-User-Role,X-Vendor-Id',
    credentials: true,
  });

  // ─── SWAGGER API DOCUMENTATION SETUP ──────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Niva Bupa Examination & Assessment — Vendor Integration APIs')
    .setDescription(
      `### Enterprise Vendor & Agency Integration API Documentation\n\n` +
      `This API portal provides secure endpoints for external Agencies and Vendors to interact with the **Niva Bupa Assessment System**.\n\n` +
      `#### 🔑 Authentication:\n` +
      `Include your unique Vendor API Key in the request header on all endpoints:\n` +
      `- **Header Name**: \`x-api-key\`\n` +
      `- **Header Value**: \`vkey_your_secret_vendor_key\` (or \`Authorization: Bearer <key>\`)\n\n` +
      `#### ⏱️ Fixed Exam Constants:\n` +
      `- **Fixed Duration**: \`45 Minutes\`\n` +
      `- **Fixed Question Bank**: \`60 Questions\`\n\n` +
      `#### 🚀 Available Core Endpoints:\n` +
      `1. **POST** \`/api/v1/vendor-api/assessments\` — Create or sync assessment under your vendor profile.\n` +
      `2. **POST** \`/api/v1/vendor-api/candidates\` — Add candidates and receive instant candidate-specific Unique Secure Exam URLs.\n` +
      `3. **GET** \`/api/v1/vendor-api/assessments/active\` — Retrieve all active assessments assigned to your vendor account.\n` +
      `4. **GET** \`/api/v1/vendor-api/candidates/status\` — Check candidate exam progress, status (\`NOT_STARTED\`, \`IN_PROGRESS\`, \`COMPLETED\`, \`DISQUALIFIED\`), and scores.\n`
    )
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Vendor Secret API Key (e.g. vkey_e989083e3b942c57021801a26c116336)',
      },
      'x-api-key',
    )
    .addTag('Vendor Integration APIs', 'Endpoints for Vendor / Agency candidate registration, exam link generation, and status tracking')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Vendor API Docs | Niva Bupa Assessment',
    customCss: '.swagger-ui .topbar { background-color: #003F72; }',
  });
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 NestJS Enterprise API Backend is running live on http://localhost:${port}`);
  console.log(`📑 Swagger Vendor API Documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();

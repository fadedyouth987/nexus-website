import express from 'express';
import path from 'node:path';
import { env, assertProductionSecrets } from './server/env';
import { errorHandler, globalRateLimit, notFound, requestId, securityMiddleware } from './server/security';
import workspacesRouter from './server/routes/workspaces';
import crmRouter from './server/routes/crm';
import servicesRouter from './server/routes/services';
import operationsRouter from './server/routes/operations';
import dashboardRouter from './server/routes/dashboard';
import integrationsRouter from './server/routes/integrations';
import intelligenceRouter from './server/routes/intelligence';
import operatorRouter from './server/routes/operator';
import teamRouter from './server/routes/team';
import billingRouter, { stripeWebhookRouter } from './server/routes/billing';

assertProductionSecrets();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number.isFinite(Number(env.TRUST_PROXY)) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);

app.use(requestId);
app.use(...securityMiddleware());
app.use(globalRateLimit);

// Stripe signature verification must see the original raw body.
app.use('/api/stripe', stripeWebhookRouter);

app.use(express.json({ limit: '512kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    product: 'Jobryn',
    version: '1.0.0-saas-foundation',
    releaseStatus: env.isProduction ? 'PRODUCTION_CONFIGURATION' : 'PRE_PRODUCTION',
    databaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    aiConfigured: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/workspaces', workspacesRouter);
app.use('/api/crm', crmRouter);
app.use('/api/services', servicesRouter);
app.use('/api/operations', operationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/operator', operatorRouter);
app.use('/api/team', teamRouter);
app.use('/api/billing', billingRouter);

async function startServer() {
  if (!env.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        if (/\.[a-f0-9]{8,}\./.test(filePath)) res.setHeader('Cache-Control', 'public,max-age=31536000,immutable');
      },
    }));
  }

  app.use('/api', notFound);

  const distPath = path.join(process.cwd(), 'dist');
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.use(errorHandler);

  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ level:'info', message:'Jobryn server started', port:env.PORT, environment:env.NODE_ENV }));
  });
}

void startServer();

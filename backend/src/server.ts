import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { requestId } from './middleware/requestId';
import { runMigrations } from './models/migrations';
import { runSeeds } from './models/seeds';
import { startScheduler } from './services/schedulerService';

// Routes
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import accountRoutes from './routes/accounts';
import categoryRoutes from './routes/categories';
import scanRoutes from './routes/scans';
import analyticsRoutes from './routes/analytics';
import reportRoutes from './routes/reports';
import budgetRoutes from './routes/budgets';
import importRoutes from './routes/import';
import recurringRoutes from './routes/recurring';
import savingsGoalRoutes from './routes/savingsGoals';
import currencyRoutes from './routes/currency';
import notificationRoutes from './routes/notifications';
import exportRoutes from './routes/export';
import uploadsRoutes from './routes/uploads';
import transfersRoutes from './routes/transfers';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const app = express();

// Trust proxy: needed when behind Render/Fly/Nginx so req.ip / rate limits work correctly.
// Trusting the first hop is the standard pattern for managed PaaS.
app.set('trust proxy', 1);

// Standard middleware
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: config.corsOrigin as any, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
  keyGenerator: (req) => {
    // P1-1: Throttle by IP + email together, so one IP can't lock other emails
    const email = (req.body && typeof req.body.email === 'string') ? req.body.email.toLowerCase().trim() : '';
    return `${req.ip}::${email}`;
  },
});
const scanUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Scan upload limit reached. Please try again later.' },
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Public routes
app.use('/api/auth', authRoutes);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Protected routes
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/accounts', authMiddleware, accountRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);
app.use('/api/scans/upload', authMiddleware, scanUploadLimiter);
app.use('/api/scans', authMiddleware, scanRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/budgets', authMiddleware, budgetRoutes);
app.use('/api/transactions/import', authMiddleware, importRoutes);
app.use('/api/recurring', authMiddleware, recurringRoutes);
app.use('/api/savings-goals', authMiddleware, savingsGoalRoutes);
app.use('/api/currency', authMiddleware, currencyRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/transactions', authMiddleware, transfersRoutes); // /api/transactions/transfers, /splits

// P0-8: authenticated, ACL-gated uploads endpoint replaces public express.static
app.use('/uploads', authMiddleware, uploadsRoutes);

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    // In production, prefer running migrations as a separate one-shot step
    // (npm run migrate). Boot-time migrations stay opt-in via RUN_MIGRATIONS_ON_BOOT.
    const shouldRunMigrationsOnBoot =
      config.nodeEnv !== 'production' || process.env.RUN_MIGRATIONS_ON_BOOT === 'true';

    if (shouldRunMigrationsOnBoot) {
      await runMigrations();
      await runSeeds();
    } else {
      console.log('Skipping migrations on boot (NODE_ENV=production, RUN_MIGRATIONS_ON_BOOT!=true). Run `npm run migrate` separately.');
    }

    // Start scheduled jobs
    if (config.nodeEnv === 'production') {
      startScheduler();
    }

    app.listen(config.port, () => {
      console.log(`PFMS API running on port ${config.port} (${config.nodeEnv})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;

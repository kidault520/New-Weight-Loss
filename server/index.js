if (!process.env.TZ) {
  process.env.TZ = 'Asia/Shanghai';
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');
const aiRoutes = require('./routes/ai');
const mealplanRoutes = require('./routes/mealplan');
const exerciseRoutes = require('./routes/exercise');
const emotionRoutes = require('./routes/emotions');
const adminAuthRoutes = require('./routes/admin/auth');
const adminUserRoutes = require('./routes/admin/users');
const adminContentRoutes = require('./routes/admin/content');
const adminStatisticsRoutes = require('./routes/admin/statistics');
const adminConfigRoutes = require('./routes/admin/config');
const adminPermissionsRoutes = require('./routes/admin/permissions');
const adminMenuRoutes = require('./routes/admin/menu');
const adminProductRoutes = require('./routes/admin/products');
const adminOrderRoutes = require('./routes/admin/orders');
const adminDeliveryRoutes = require('./routes/admin/deliveries');
const adminSchedulesRoutes = require('./routes/admin/schedules');
const adminSalesPersonsRoutes = require('./routes/admin/salesPersons');
const adminSyncOrgRoutes = require('./routes/admin/syncOrganization');
const adminSalesProductConfigRoutes = require('./routes/admin/salesProductConfig');
const adminIntegrationsRoutes = require('./routes/admin/integrations');
const salesAuthRoutes = require('./routes/sales/auth');
const deliverySchedulesRoutes = require('./routes/deliverySchedules');
const deliveryCallbacksRoutes = require('./routes/deliveryCallbacks');
const orderRoutes = require('./routes/orders');
const { startDeliveryReconcileScheduler } = require('./services/deliveryReconcileScheduler');
const { startMealScheduleActivationScheduler } = require('./services/mealScheduleActivationScheduler');
const { ensureOtpStoreReady } = require('./services/otpStore');
const { apiLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { getRuntimePolicy } = require('./config/runtimeMode');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;
const runtimePolicy = getRuntimePolicy();

/** 生产环境默认前端域名；另可通过 CORS_ORIGINS 追加（逗号分隔），例如 Vercel 预览/正式站 */
function getProductionCorsOrigins() {
  const defaults = [
    'https://redanwell-cro4.bolt.host',
    'https://admin.redanwell-cro4.bolt.host',
  ];
  const extra = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...defaults, ...extra];
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? getProductionCorsOrigins()
    : [
        'http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175',
        'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175',
      ],
  credentials: true
}));

// Use winston logger for HTTP requests
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/mealplans', mealplanRoutes);
app.use('/api/exercise', exerciseRoutes);
app.use('/api/emotions', emotionRoutes);
app.use('/api/delivery-schedules', deliverySchedulesRoutes);
app.use('/api/delivery-callbacks', deliveryCallbacksRoutes);
app.use('/api/orders', orderRoutes);

// Admin routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/content', adminContentRoutes);
app.use('/api/admin/statistics', adminStatisticsRoutes);
app.use('/api/admin/config', adminConfigRoutes);
app.use('/api/admin/permissions', adminPermissionsRoutes);
app.use('/api/admin/menu', adminMenuRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/deliveries', adminDeliveryRoutes);
app.use('/api/admin/schedules', adminSchedulesRoutes);
app.use('/api/admin/sales-persons', adminSalesPersonsRoutes);
app.use('/api/admin/sync-organization', adminSyncOrgRoutes);
app.use('/api/admin/sales-product-config', adminSalesProductConfigRoutes);
app.use('/api/admin/integrations', adminIntegrationsRoutes);
app.use('/api/sales/auth', salesAuthRoutes);

// Health check endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    runtime_mode: runtimePolicy.mode,
    strict_mode: runtimePolicy.strict,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await ensureOtpStoreReady();
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(
        `[runtime] mode=${runtimePolicy.mode} strict=${runtimePolicy.strict} allowSimulatedPayment=${runtimePolicy.allowSimulatedPayment} allowSimulatedDelivery=${runtimePolicy.allowSimulatedDelivery} allowSimulatedSms=${runtimePolicy.allowSimulatedSms}`,
      );
      startDeliveryReconcileScheduler();
      startMealScheduleActivationScheduler();
    });
  } catch (e) {
    logger.error(`Failed to start server: ${e?.message || e}`);
    process.exit(1);
  }
}

startServer();

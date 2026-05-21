import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from './config/index.js';
import authRouter from './modules/auth/auth.routes.js';

const app = express();

// Standard middleware in the exact requested order:
// 1. express.json()
app.use(express.json());

// 2. express.urlencoded()
app.use(express.urlencoded({ extended: true }));

// 3. helmet()
app.use(helmet());

// 4. cors() with origin from config
app.use(cors({
  origin: config.NEXT_PUBLIC_APP_URL || '*',
  credentials: true
}));

// 5. cookieParser() and mongoSanitize()
app.use(cookieParser());
app.use(mongoSanitize());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Mount auth router
app.use('/api/auth', authRouter);

// Import and mount all module routers under /api prefix (commented out until created)
import patientRouter from './modules/patients/patient.routes.js';
import visitRouter from './modules/visits/visit.routes.js';
import resultRouter from './modules/results/result.routes.js';
import reportRouter from './modules/reports/report.routes.js';
import alertRouter from './modules/results/alert.routes.js';
import sampleRouter from './modules/samples/sample.routes.js';
// import billingRouter from './modules/billing/billing.routes.js';
// import inventoryRouter from './modules/inventory/inventory.routes.js';
// import doctorRouter from './modules/doctors/doctor.routes.js';
// import staffRouter from './modules/staff/staff.routes.js';
// import notificationRouter from './modules/notifications/notification.routes.js';
// import webhookRouter from './modules/webhooks/webhook.routes.js';
// import analyticsRouter from './modules/analytics/analytics.routes.js';
// import homeCollectionRouter from './modules/homeCollections/homeCollection.routes.js';

// Route mountings under /api
app.use('/api/patients', patientRouter);
app.use('/api/visits', visitRouter);
app.use('/api/results', resultRouter);
app.use('/api/reports', reportRouter);
app.use('/api/critical', alertRouter);
app.use('/api/samples', sampleRouter);
// app.use('/api/billing', billingRouter);
// app.use('/api/inventory', inventoryRouter);
// app.use('/api/doctors', doctorRouter);
// app.use('/api/staff', staffRouter);
// app.use('/api/notifications', notificationRouter);
// app.use('/api/webhooks', webhookRouter);
// app.use('/api/analytics', analyticsRouter);
// app.use('/api/home-collections', homeCollectionRouter);

export default app;
export { app };

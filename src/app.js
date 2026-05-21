import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';

const app = express();

// Security and parser middleware
app.use(helmet());
app.use(cors({
  origin: config.NEXT_PUBLIC_APP_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Module Routers (Mount Points)
// TODO: Import routers once created
// import authRouter from './modules/auth/auth.routes.js';
// import patientRouter from './modules/patients/patient.routes.js';
// import visitRouter from './modules/visits/visit.routes.js';
// import resultRouter from './modules/results/result.routes.js';
// import reportRouter from './modules/reports/report.routes.js';
// import billingRouter from './modules/billing/billing.routes.js';
// import inventoryRouter from './modules/inventory/inventory.routes.js';
// import doctorRouter from './modules/doctors/doctor.routes.js';
// import staffRouter from './modules/staff/staff.routes.js';
// import notificationRouter from './modules/notifications/notification.routes.js';
// import webhookRouter from './modules/webhooks/webhook.routes.js';
// import analyticsRouter from './modules/analytics/analytics.routes.js';
// import homeCollectionRouter from './modules/homeCollections/homeCollection.routes.js';
// import sampleRouter from './modules/samples/sample.routes.js';

// Router mountings
// app.use('/api/auth', authRouter);
// app.use('/api/patients', patientRouter);
// app.use('/api/visits', visitRouter);
// app.use('/api/results', resultRouter);
// app.use('/api/reports', reportRouter);
// app.use('/api/billing', billingRouter);
// app.use('/api/inventory', inventoryRouter);
// app.use('/api/doctors', doctorRouter);
// app.use('/api/staff', staffRouter);
// app.use('/api/notifications', notificationRouter);
// app.use('/api/webhooks', webhookRouter);
// app.use('/api/analytics', analyticsRouter);
// app.use('/api/home-collections', homeCollectionRouter);
// app.use('/api/samples', sampleRouter);

export default app;

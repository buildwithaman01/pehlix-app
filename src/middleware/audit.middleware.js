import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  role: {
    type: String
  },
  action: {
    type: String,
    required: true
  },
  statusCode: {
    type: Number
  },
  duration: {
    type: Number
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  isImpersonation: {
    type: Boolean,
    default: false
  },
  impersonatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  superAdmin: {
    type: Boolean,
    default: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  }
});

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

/**
 * Middleware to log request and response metadata to the database asynchronously.
 */
export async function auditLog(req, res, next) {
  req.startTime = Date.now();

  res.on('finish', () => {
    try {
      const duration = Date.now() - req.startTime;
      const logData = {
        labId: req.user?.labId || null,
        userId: req.user?.userId || null,
        role: req.user?.role || null,
        action: `${req.method} ${req.originalUrl || req.path}`,
        statusCode: res.statusCode,
        duration,
        ip: req.ip || req.socket.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
        isImpersonation: req.user?.isImpersonation || false,
        impersonatedBy: req.user?.impersonatedBy || null
      };

      // Asynchronous creation (fire and forget) to avoid blocking response pipeline
      AuditLog.create(logData).catch(err => {
        console.error('Audit log save failed:', err);
      });
    } catch (err) {
      console.error('Error during audit log calculation:', err);
    }
  });

  next();
}
export { AuditLog };

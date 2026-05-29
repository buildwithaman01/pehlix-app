import mongoose from 'mongoose';

let cachedConnection = null;

/**
 * Connects to MongoDB, caching the connection for serverless/Vercel reuse.
 * @returns {Promise<typeof mongoose>} Mongoose connection instance
 */
export async function connectDB() {
  // If connection is already cached and connected, return immediately
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  cachedConnection = await mongoose.connect(uri, options);

  // Seed standard global catalog asynchronously
  import('./seedCatalog.js').then(({ seedGlobalCatalog }) => {
    seedGlobalCatalog();
  }).catch(err => {
    console.error('Failed to start catalog seeding:', err);
  });

  return cachedConnection;
}

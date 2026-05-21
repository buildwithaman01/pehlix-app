import { connectDB } from './utils/db.js';
import app from './app.js';
import { config } from './config/index.js';

async function startServer() {
  try {
    await connectDB();
    console.log('Database connection initialized');
    
    const PORT = config.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

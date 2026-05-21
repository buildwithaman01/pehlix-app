import { connectDB } from './utils/db.js';
import app from './app.js';

async function startServer() {
  try {
    // 1. Connect to DB
    await connectDB();
    
    // 2. Listen on process.env.PORT or 3000
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

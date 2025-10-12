// server.js
const app = require('./src/app');
const { connectDatabase } = require('./src/config/database');
// const { connectRedis } = require('./src/config/redis'); // Disabled for now
// const { startInventoryMonitoring } = require('./src/services/inventoryService'); // May depend on Redis

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to databases
    await connectDatabase();
    
    // Temporarily disable Redis and inventory monitoring
    // await connectRedis();
    // startInventoryMonitoring();
    
    app.listen(PORT, () => {
      console.log(`🚀 Big Bonney Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
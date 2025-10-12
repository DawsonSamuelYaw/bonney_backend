// src/config/redis.js - Updated to handle Redis being unavailable
const redis = require('redis');

let client = null;
let isRedisConnected = false;

const connectRedis = async () => {
  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // End reconnecting on a specific error and flush all commands with error
          console.warn('Redis server refused connection. Running without Redis cache.');
          return undefined;
        }
        if (options.total_retry_time > 1000 * 60) {
          // End reconnecting after a specific timeout and flush all commands with error
          console.warn('Redis connection timeout. Running without Redis cache.');
          return undefined;
        }
        if (options.attempt > 3) {
          // End reconnecting with built in error
          console.warn('Redis connection failed after 3 attempts. Running without Redis cache.');
          return undefined;
        }
        // Reconnect after
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      console.warn('Redis Client Error (non-critical):', err.message);
      isRedisConnected = false;
    });

    client.on('connect', () => {
      console.log('✅ Redis connection established successfully');
      isRedisConnected = true;
    });

    await client.connect();
  } catch (error) {
    console.warn('⚠️ Redis unavailable - continuing without cache functionality');
    console.warn('To install Redis: brew install redis (Mac) or sudo apt install redis-server (Ubuntu)');
    isRedisConnected = false;
    client = null;
  }
};

const getRedisClient = () => {
  return isRedisConnected ? client : null;
};

const setCache = async (key, value, ttl = 3600) => {
  if (!isRedisConnected || !client) return false;
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Redis set failed:', error.message);
    return false;
  }
};

const getCache = async (key) => {
  if (!isRedisConnected || !client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn('Redis get failed:', error.message);
    return null;
  }
};

const deleteCache = async (key) => {
  if (!isRedisConnected || !client) return false;
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.warn('Redis delete failed:', error.message);
    return false;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  isRedisConnected: () => isRedisConnected
};
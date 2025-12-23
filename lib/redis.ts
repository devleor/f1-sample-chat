import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL is not defined in environment variables. Defaulting to localhost.');
}

const redis = new Redis(REDIS_URL);

export default redis;

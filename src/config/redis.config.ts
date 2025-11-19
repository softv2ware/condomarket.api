import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'condomarket:',
  
  // Connection pool settings
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  
  // Sentinel support (for HA Redis)
  sentinels: process.env.REDIS_SENTINELS
    ? JSON.parse(process.env.REDIS_SENTINELS)
    : undefined,
  sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
  
  // Cluster support
  cluster: process.env.REDIS_CLUSTER === 'true',
  clusterNodes: process.env.REDIS_CLUSTER_NODES
    ? JSON.parse(process.env.REDIS_CLUSTER_NODES)
    : undefined,
}));

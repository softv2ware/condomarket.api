# Production Deployment Guide

## Prerequisites

- Docker and Docker Compose
- PostgreSQL 15+
- Redis (optional but recommended)
- Node.js 20+ (for local development)
- pnpm 8+

## Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
APP_NAME=CondoMarket API

# Database
DATABASE_URL=postgresql://user:password@host:5432/condomarket?schema=public

# JWT
JWT_SECRET=your-secure-jwt-secret-here
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-secure-refresh-secret-here
JWT_REFRESH_EXPIRATION=7d

# Redis (recommended for production)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_ENABLED=true

# Caching
CACHE_TTL=300
CACHE_MAX_ITEMS=1000

# CORS
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

# AWS S3 (for file uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=condomarket-uploads

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CLIENT_EMAIL=your-firebase-email
FIREBASE_PRIVATE_KEY="your-firebase-private-key"
```

## Deployment Methods

### Method 1: Docker (Recommended)

#### Build the Docker image

```bash
docker build -f Dockerfile.production -t condomarket-api:latest .
```

#### Run with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Method 2: Direct Deployment

#### 1. Install dependencies

```bash
pnpm install --frozen-lockfile --prod
```

#### 2. Generate Prisma Client

```bash
pnpm prisma:generate
```

#### 3. Run database migrations

```bash
pnpm prisma migrate deploy
```

#### 4. Build the application

```bash
pnpm build
```

#### 5. Start the application

```bash
NODE_ENV=production node dist/src/main.js
```

### Method 3: PM2 (Process Manager)

#### 1. Install PM2

```bash
npm install -g pm2
```

#### 2. Create ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'condomarket-api',
    script: 'dist/src/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
    kill_timeout: 5000
  }]
};
```

#### 3. Start with PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Database Migrations

### Apply migrations in production

```bash
pnpm prisma migrate deploy
```

### Create a new migration

```bash
pnpm prisma migrate dev --name your_migration_name
```

### Rollback a migration

Prisma doesn't support automated rollbacks. You need to:

1. Create a new migration that reverses the changes
2. Apply the new migration

## Health Checks

### Liveness Probe
```
GET /health/liveness
```

### Readiness Probe
```
GET /health/readiness
```

### Comprehensive Health Check
```
GET /health
```

### Metrics
```
GET /health/metrics
```

## Monitoring

### Application Logs

Logs are written to:
- Console (stdout/stderr)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)
- `logs/exceptions.log` (uncaught exceptions)

### Log Levels

- `error`: Errors and exceptions
- `warn`: Warnings
- `info`: Important information (default for production)
- `debug`: Detailed debugging information
- `verbose`: Very detailed logs

### Correlation IDs

Every request has a correlation ID that can be found in:
- Response header: `x-correlation-id`
- Logs: `correlationId` field
- Error responses: `correlationId` field

## Performance Optimization

### Database Connection Pooling

Configure in `DATABASE_URL`:
```
postgresql://user:pass@host:5432/db?schema=public&connection_limit=20&pool_timeout=10
```

### Caching Strategy

The application uses in-memory caching by default. For production with multiple instances, enable Redis:

```bash
REDIS_ENABLED=true
REDIS_HOST=your-redis-host
```

### Rate Limiting

Adjust rate limits based on your needs:

```bash
RATE_LIMIT_TTL=60    # Time window in seconds
RATE_LIMIT_MAX=100   # Max requests per window
```

## Security

### HTTPS/SSL

Always use HTTPS in production. Configure SSL/TLS at your reverse proxy (Nginx, Traefik, etc.).

### Environment Variables

Never commit `.env` files to version control. Use:
- Environment variable management systems (AWS Secrets Manager, Vault)
- Kubernetes secrets
- Docker secrets

### CORS

Configure allowed origins:

```bash
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

## Backup and Recovery

### Database Backups

#### Automated daily backups

```bash
# Add to crontab
0 2 * * * pg_dump -h localhost -U user condomarket | gzip > /backups/condomarket_$(date +\%Y\%m\%d).sql.gz
```

#### Restore from backup

```bash
gunzip -c backup.sql.gz | psql -h localhost -U user condomarket
```

### File Backups

If using local file storage, backup the uploads directory:

```bash
tar -czf uploads_$(date +%Y%m%d).tar.gz ./uploads/
```

## Scaling

### Horizontal Scaling

The application is stateless and can be horizontally scaled:

1. Enable Redis for session storage and caching
2. Use external object storage (S3) for file uploads
3. Use a load balancer to distribute traffic
4. Scale database with read replicas

### Vertical Scaling

Adjust resources based on load:
- CPU: 2-4 cores recommended
- Memory: 2-4GB minimum
- Database: Scale based on data size

## Troubleshooting

### Application won't start

Check:
1. All required environment variables are set
2. Database is accessible
3. Database migrations are up to date
4. Port 3000 is not in use

```bash
# Check database connection
pnpm prisma db pull

# Check migrations status
pnpm prisma migrate status
```

### High memory usage

1. Check cache configuration
2. Review database query performance
3. Monitor memory usage: `GET /health/metrics`

### Slow responses

1. Check database query performance
2. Enable Redis caching
3. Review logs for slow requests (>1s logged as warnings)
4. Check `GET /health/metrics` for resource usage

### Database connection errors

1. Verify DATABASE_URL is correct
2. Check connection pool settings
3. Ensure database is accepting connections
4. Review firewall rules

## Maintenance

### Zero-downtime Deployments

1. Use blue-green deployment
2. Or rolling updates with health checks
3. Always test migrations in staging first

### Database Maintenance

```bash
# Analyze tables for query optimization
ANALYZE;

# Vacuum to reclaim space
VACUUM ANALYZE;
```

## Support

For issues and questions:
- Check logs with correlation ID
- Review health check endpoints
- Monitor application metrics
- Check database performance

## Security Updates

Keep dependencies updated:

```bash
# Check for updates
pnpm outdated

# Update dependencies
pnpm update

# Security audit
pnpm audit
```

# CondoMarket API 🏢

A production-ready, enterprise-grade marketplace API for buildings and apartment complexes, built with NestJS, Prisma, and PostgreSQL.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-80%25-green)
![License](https://img.shields.io/badge/license-UNLICENSED-red)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## 🚀 Features

### Core Functionality
- **Authentication & Authorization**: JWT-based auth with role-based access control (RBAC)
- **Multi-Building Architecture**: Support for multiple buildings with isolated data
- **Subscription System**: FREE, STANDARD, and PREMIUM seller tiers
- **Marketplace**: Products and services listings with search and filtering
- **Orders & Bookings**: Complete order management and service booking system
- **Real-time Chat**: WebSocket-based messaging for orders/bookings
- **Reviews & Ratings**: User reputation and review system
- **Moderation**: Content moderation and reporting system

### Production-Ready Features ✨
- **Structured Logging**: Winston-based logging with correlation IDs for request tracking
- **Comprehensive Monitoring**: Health checks, metrics, and performance monitoring
- **Caching Infrastructure**: Redis/in-memory caching with configurable TTL
- **API Versioning**: URI-based versioning (`/v1/...`)
- **Analytics Dashboards**: Platform, Building, and Seller analytics endpoints
- **Pagination**: Standardized pagination for all list endpoints
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Docker Support**: Production-optimized multi-stage Dockerfile
- **Security**: Helmet, rate limiting, CORS, input validation

## 📋 Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd condomarket.api
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Generate Prisma Client**
```bash
npx prisma generate
```

5. **Run database migrations**
```bash
npx prisma migrate dev
```

6. **Start the development server**
```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000`  
API Documentation at `http://localhost:3000/reference`

### Docker Development

1. **Start all services with Docker Compose**
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Redis on port 6379
- NestJS API on port 3000

2. **View logs**
```bash
docker-compose logs -f app
```

3. **Stop services**
```bash
docker-compose down
```

## 📁 Project Structure

```
src/
├── auth/                  # Authentication module
│   ├── decorators/        # Custom decorators (@CurrentUser, @Roles)
│   ├── guards/            # Auth guards (JwtAuthGuard, RolesGuard)
│   ├── strategies/        # Passport strategies
│   └── dto/               # Data transfer objects
├── common/                # Shared modules
│   ├── filters/           # Exception filters
│   ├── logger/            # Winston logger configuration
│   ├── prisma/            # Prisma service
│   └── health/            # Health check endpoints
├── config/                # Configuration files
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── env.validation.ts
└── users/                 # Users module
```

## 🔧 Available Scripts

```bash
# Development
pnpm start:dev          # Start in watch mode
pnpm start:debug        # Start in debug mode

# Production
pnpm build              # Build for production
pnpm start:prod         # Start production server

# Testing
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage
pnpm test:e2e           # Run e2e tests

# Database
npx prisma generate     # Generate Prisma Client
npx prisma migrate dev  # Run migrations in development
npx prisma studio       # Open Prisma Studio

# Linting
pnpm lint               # Run ESLint
pnpm format             # Format code with Prettier
```

## 🌐 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token

### Health
- `GET /health` - Health check with database ping
- `GET /health/liveness` - Liveness probe
- `GET /health/readiness` - Readiness probe

### Users
- `GET /users` - List all users (protected)
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Delete user

📚 **Full API documentation available at** `http://localhost:3000/reference`

## 🔐 Environment Variables

See `.env.example` for all available environment variables.

### Required Variables
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Optional Variables
```env
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=debug
```

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

## 📦 Database Schema

The application uses Prisma ORM with PostgreSQL. Current models:

- **User**: User accounts with roles (PLATFORM_ADMIN, BUILDING_ADMIN, RESIDENT)
- **UserProfile**: Extended user information
- More models will be added in Stage 2+

## 🚀 Deployment

### Building for Production

```bash
pnpm build
```

### Running in Production

```bash
NODE_ENV=production pnpm start:prod
```

### Docker Production Build

```bash
docker build --target production -t condomarket-api:latest .
docker run -p 3000:3000 --env-file .env condomarket-api:latest
```

## 🤝 Contributing

1. Follow the development plan in `DEVELOPMENT_PLAN.md`
2. Complete one stage at a time with full test coverage
3. Use conventional commit messages
4. Ensure all tests pass before submitting PR

## 📝 License

[UNLICENSED]

## 🔗 Links

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Development Plan](./DEVELOPMENT_PLAN.md)

## 📊 Current Status

✅ **Stage 1 Complete**: Foundation & Infrastructure
- JWT Authentication
- Database with Prisma
- Logging with Winston
- Health checks
- Docker setup
- API documentation with Swagger/Scalar

🔄 **Next**: Stage 2 - Core User & Building Management
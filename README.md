# CondoMarket API 🏢

A production-ready, enterprise-grade marketplace API for buildings and apartment complexes, built with NestJS, Prisma, and PostgreSQL.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-80%25-green)
![License](https://img.shields.io/badge/license-UNLICENSED-red)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## 📚 API Documentation

**Full API Reference**: [https://api.condomarket.v2dev.xyz/reference](https://api.condomarket.v2dev.xyz/reference)

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Mobile[Mobile App]
        Web[Web App]
    end
    
    subgraph "API Gateway"
        Gateway[NestJS API Server]
    end
    
    subgraph "Core Modules"
        Auth[Authentication]
        Users[User Management]
        Buildings[Building Management]
        Listings[Marketplace]
    end
    
    subgraph "Feature Modules"
        Orders[Orders]
        Bookings[Bookings]
        Chat[Real-time Chat]
        Reviews[Reviews & Ratings]
        Moderation[Content Moderation]
        Notifications[Notifications]
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
        Firebase[Firebase Auth]
    end
    
    Mobile --> Gateway
    Web --> Gateway
    Gateway --> Auth
    Gateway --> Core Modules
    Gateway --> Feature Modules
    Auth --> Firebase
    Core Modules --> PostgreSQL
    Feature Modules --> PostgreSQL
    Gateway --> Redis
```

## 🚀 Features

### Core Functionality
- **Authentication & Authorization**: Firebase + JWT-based auth with role-based access control (RBAC)
- **Multi-Building Architecture**: Support for multiple buildings with isolated data and settings
- **Subscription System**: FREE, STANDARD, and PREMIUM seller tiers with feature limits
- **Marketplace**: Products and services listings with advanced search and filtering
- **Orders & Bookings**: Complete order management and service booking system with status workflows
- **Real-time Chat**: WebSocket-based messaging for orders/bookings communication
- **Reviews & Ratings**: Comprehensive user reputation and review system
- **Moderation**: Content moderation, reporting, and user restriction system
- **Notifications**: Email notifications with Handlebars templates

### Production-Ready Features ✨
- **Structured Logging**: Winston-based logging with correlation IDs for request tracking
- **Comprehensive Monitoring**: Health checks, metrics, and performance monitoring
- **Production-Grade Caching**: Redis-powered distributed caching with ioredis (see [REDIS_CACHING.md](./REDIS_CACHING.md))
  - Pattern-based cache invalidation
  - Bulk operations (MGET/MSET)
  - TTL management and inspection
  - Redis Sentinel & Cluster support
  - Automatic fallback to in-memory cache
- **API Versioning**: URI-based versioning (`/v1/...`)
- **Analytics Dashboards**: Platform, Building, and Seller analytics endpoints
- **Pagination**: Standardized pagination for all list endpoints
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Docker Support**: Production-optimized multi-stage Dockerfile with Redis
- **Security**: Helmet, rate limiting, CORS, input validation, Firebase Authentication

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
├── auth/                       # Authentication & Authorization
├── users/                      # User Management
├── buildings/                  # Building Management
├── building-settings/          # Building Configuration
├── verification/               # Building & Unit Verification
├── listings/                   # Marketplace Listings
├── categories/                 # Listing Categories
├── orders/                     # Product Orders
├── bookings/                   # Service Bookings
├── transactions/               # Payment Transactions
├── subscription-plans/         # Subscription Plan Definitions
├── seller-subscriptions/       # Seller Subscription Management
├── chat/                       # Real-time Messaging
├── notifications/              # Email Notifications
├── reviews/                    # Reviews & Ratings
├── reputation/                 # User Reputation System
├── moderation/                 # Content Moderation
├── reports/                    # User Reports
├── blocking/                   # User Blocking
├── common/                     # Shared Infrastructure
│   ├── cache/                  # Redis Cache Service
│   ├── logger/                 # Winston Logger
│   ├── prisma/                 # Database Service
│   ├── firebase/               # Firebase Admin
│   └── health/                 # Health Checks
└── config/                     # Configuration Files
```

## 🧩 Module Documentation

### 🔐 Authentication Module

**Purpose**: Handles user authentication and authorization with Firebase and JWT.

**Key Features**:
- Firebase Authentication integration
- JWT token generation and validation
- Role-based access control (RBAC)
- Custom decorators: `@CurrentUser()`, `@Roles()`, `@Public()`
- Guards: `JwtAuthGuard`, `RolesGuard`, `BuildingAccessGuard`

**User Roles**:
- `PLATFORM_ADMIN`: Full system access
- `BUILDING_ADMIN`: Building management
- `RESIDENT`: Standard user access

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Firebase
    participant DB
    
    Client->>API: POST /auth/register (Firebase Token)
    API->>Firebase: Verify Token
    Firebase-->>API: User Claims
    API->>DB: Create/Update User
    DB-->>API: User Data
    API-->>Client: JWT Access + Refresh Tokens
    
    Client->>API: Protected Request (JWT)
    API->>API: Verify JWT
    API->>DB: Check Permissions
    API-->>Client: Response
```

---

### 👥 Users Module

**Purpose**: User profile and account management.

**Key Features**:
- User profile CRUD operations
- Profile picture management
- Building membership tracking
- Role assignment and management
- User search and filtering

**Entities**:
- `User`: Core user account (linked to Firebase)
- `UserProfile`: Extended profile information

---

### 🏢 Buildings Module

**Purpose**: Multi-tenant building management system.

**Key Features**:
- Building CRUD operations with admin management
- Building-specific isolation of data
- Address and contact information
- Building verification status
- Member management

**Data Flow**:
```mermaid
graph LR
    Admin[Building Admin] --> Create[Create Building]
    Create --> Verification[Verification Process]
    Verification --> Active[Active Building]
    Active --> Units[Manage Units]
    Active --> Settings[Configure Settings]
    Resident[Residents] --> Join[Join Building]
    Join --> Verify[Verify Unit]
```

---

### ⚙️ Building Settings Module

**Purpose**: Configurable settings per building.

**Key Features**:
- Enable/disable marketplace features
- Enable/disable chat functionality
- Require verification settings
- Auto-approval configurations
- Default category management

---

### ✅ Verification Module

**Purpose**: Verify building units and resident ownership.

**Key Features**:
- Building verification requests
- Unit verification requests
- Document upload and review
- Admin approval workflow
- Status tracking (PENDING, APPROVED, REJECTED)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Submit Request
    PENDING --> APPROVED: Admin Approves
    PENDING --> REJECTED: Admin Rejects
    APPROVED --> [*]
    REJECTED --> PENDING: Resubmit
```

---

### 🏪 Listings Module

**Purpose**: Marketplace for products and services.

**Key Features**:
- Create products and services listings
- Advanced search with filters
- Image gallery support
- Status management (DRAFT, ACTIVE, SOLD, EXPIRED)
- Building-specific listings
- View tracking and analytics

**Listing Types**:
- `PRODUCT`: Physical items for sale
- `SERVICE`: Services offered by residents

```mermaid
graph TB
    Seller[Seller] --> Create[Create Listing]
    Create --> Draft[DRAFT Status]
    Draft --> Publish[Publish]
    Publish --> Active[ACTIVE Status]
    Active --> Sold[Mark as SOLD]
    Active --> Expire[Auto-Expire]
    Active --> Deactivate[Deactivate]
```

---

### 📁 Categories Module

**Purpose**: Organize listings into categories.

**Key Features**:
- Hierarchical category structure
- Parent-child relationships
- Building-specific categories
- Default categories for all buildings

---

### 📦 Orders Module

**Purpose**: Handle product purchases and order lifecycle.

**Key Features**:
- Order creation and management
- Status workflow (PENDING → CONFIRMED → COMPLETED/CANCELLED)
- Chat integration for buyer-seller communication
- Order history and tracking
- Status change notifications

```mermaid
stateDiagram-v2
    [*] --> PENDING: Create Order
    PENDING --> CONFIRMED: Seller Confirms
    PENDING --> CANCELLED: Buyer/Seller Cancels
    CONFIRMED --> COMPLETED: Mark Complete
    CONFIRMED --> CANCELLED: Cancel
    COMPLETED --> [*]
    CANCELLED --> [*]
```

---

### 📅 Bookings Module

**Purpose**: Schedule and manage service bookings.

**Key Features**:
- Service booking creation
- Scheduled date/time management
- Status workflow (PENDING → CONFIRMED → COMPLETED/CANCELLED)
- Chat integration
- Booking history
- Status change notifications

**Similar workflow to Orders** with additional scheduling capabilities.

---

### 💳 Transactions Module

**Purpose**: Financial transaction tracking (future payment integration).

**Key Features**:
- Transaction record keeping
- Payment method tracking
- Transaction status management
- Order/booking association
- Transaction history

---

### 📊 Subscription Plans Module

**Purpose**: Define seller subscription tiers.

**Available Plans**:
- **FREE**: Limited listings (5), basic features
- **STANDARD**: More listings (20), priority support
- **PREMIUM**: Unlimited listings, all features, priority placement

**Features**:
- Define plan limits and pricing
- Feature toggles per plan
- Billing cycle configuration

---

### 💎 Seller Subscriptions Module

**Purpose**: Manage seller subscription lifecycle.

**Key Features**:
- Subscribe to plans
- Automatic renewal
- Upgrade/downgrade functionality
- Subscription status tracking
- Usage tracking against limits
- Trial periods

```mermaid
graph LR
    Free[FREE Plan] --> Upgrade1[Subscribe to STANDARD]
    Upgrade1 --> Active1[ACTIVE Subscription]
    Active1 --> Renew[Auto-Renew]
    Active1 --> Upgrade2[Upgrade to PREMIUM]
    Upgrade2 --> Active2[ACTIVE Premium]
    Active2 --> Downgrade[Downgrade]
    Active1 --> Cancel[Cancel]
    Cancel --> Expired[EXPIRED]
```

---

### 💬 Chat Module

**Purpose**: Real-time messaging between users.

**Key Features**:
- WebSocket-based real-time messaging
- Order and booking specific chats
- Unread message tracking
- Message history
- Online status
- Typing indicators

**Technology**: Socket.IO with JWT authentication

```mermaid
sequenceDiagram
    participant Buyer
    participant WebSocket
    participant Server
    participant Seller
    
    Buyer->>WebSocket: Connect (JWT)
    Seller->>WebSocket: Connect (JWT)
    Buyer->>Server: Send Message
    Server->>WebSocket: Broadcast to Room
    WebSocket->>Seller: Deliver Message
    Seller->>Server: Read Receipt
    Server->>Buyer: Update Status
```

---

### 📧 Notifications Module

**Purpose**: Send email notifications to users.

**Key Features**:
- Handlebars email templates
- Order status notifications
- Booking status notifications
- Welcome emails
- Verification updates
- Batch notification support

**Supported Events**:
- User registration
- Order status changes
- Booking confirmations
- Verification approvals/rejections

---

### ⭐ Reviews Module

**Purpose**: Review and rating system for completed transactions.

**Key Features**:
- Rate orders and bookings (1-5 stars)
- Written reviews with feedback
- Photos attachment support
- Seller response to reviews
- Review moderation
- Edit and delete reviews

**Restrictions**:
- Only for completed orders/bookings
- One review per transaction
- Time-limited editing

---

### 🏆 Reputation Module

**Purpose**: Calculate and track user reputation scores.

**Key Features**:
- Automatic reputation calculation
- Based on reviews received
- Average rating tracking
- Total reviews count
- Historical reputation tracking
- Seller ranking

**Calculation**:
- Average star rating from all reviews
- Weighted by recency
- Total review count factor

---

### 🛡️ Moderation Module

**Purpose**: Content moderation and user restriction management.

**Key Features**:
- Review flagged content
- User restriction (warnings, suspensions, bans)
- Moderation action tracking
- Automated flagging rules
- Admin moderation dashboard
- Appeal process

**Restriction Types**:
- `WARNING`: First offense
- `SUSPENSION`: Temporary ban
- `BAN`: Permanent removal

```mermaid
graph TB
    Report[User Report] --> Review[Admin Review]
    AutoFlag[Auto-Flagged] --> Review
    Review --> NoAction[No Action]
    Review --> Warning[Issue Warning]
    Review --> Suspend[Suspend User]
    Review --> Ban[Ban User]
    Warning --> SecondOffense[Second Offense]
    SecondOffense --> Suspend
```

---

### 🚩 Reports Module

**Purpose**: User reporting system for inappropriate content.

**Key Features**:
- Report listings, users, reviews
- Report categorization
- Status tracking (PENDING, REVIEWING, RESOLVED, DISMISSED)
- Admin review workflow
- Reporter anonymity option
- Duplicate report detection

**Report Categories**:
- Inappropriate content
- Spam
- Fraud
- Harassment
- Other violations

---

### 🚫 Blocking Module

**Purpose**: Allow users to block other users.

**Key Features**:
- Block/unblock users
- Prevent messaging from blocked users
- Hide listings from blocked users
- Mutual blocking support
- Block list management

---

### 🛠️ Common Infrastructure

#### Cache Service
- Redis-based distributed caching
- Pattern-based invalidation
- TTL management
- Bulk operations
- Automatic fallback

#### Logger Service
- Winston-based structured logging
- Correlation ID tracking
- Log levels (debug, info, warn, error)
- Request/response logging
- Performance metrics

#### Prisma Service
- Database connection management
- Transaction support
- Soft delete middleware
- Query optimization
- Connection pooling

#### Firebase Service
- Firebase Admin SDK integration
- Token verification
- User management
- Custom claims

#### Health Check Service
- Liveness probes
- Readiness probes
- Database health
- Redis health
- Memory usage monitoring

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

## 🔄 Data Flow Examples

### Creating a Listing and Receiving an Order

```mermaid
sequenceDiagram
    participant Seller
    participant API
    participant DB
    participant Cache
    participant Buyer
    participant Email
    
    Seller->>API: POST /listings (Create Product)
    API->>DB: Save Listing
    API->>Cache: Invalidate Listings Cache
    API-->>Seller: Listing Created
    
    Buyer->>API: GET /listings (Browse)
    API->>Cache: Check Cache
    Cache-->>API: Cache Miss
    API->>DB: Query Listings
    DB-->>API: Results
    API->>Cache: Store Results
    API-->>Buyer: Listings
    
    Buyer->>API: POST /orders (Create Order)
    API->>DB: Create Order + Chat Room
    API->>Email: Send Notification to Seller
    API-->>Buyer: Order Confirmed
    
    Seller->>API: PATCH /orders/:id (Confirm Order)
    API->>DB: Update Status
    API->>Email: Send Notification to Buyer
    API-->>Seller: Updated
```

### Subscription Limit Enforcement

```mermaid
graph TB
    Seller[Seller Attempts Action] --> Check{Check Subscription}
    Check --> Free[FREE Plan: 5 Listings]
    Check --> Standard[STANDARD: 20 Listings]
    Check --> Premium[PREMIUM: Unlimited]
    
    Free --> Count1{Current < Limit?}
    Standard --> Count2{Current < Limit?}
    Premium --> Allow[Always Allow]
    
    Count1 --> |Yes| Allow
    Count1 --> |No| Deny[Deny + Suggest Upgrade]
    Count2 --> |Yes| Allow
    Count2 --> |No| Deny
```

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

The application uses Prisma ORM with PostgreSQL. Key models and relationships:

```mermaid
erDiagram
    User ||--o| UserProfile : has
    User ||--o{ Building : administers
    User ||--o{ Unit : owns
    User ||--o{ Listing : creates
    User ||--o{ Order : places
    User ||--o{ Review : writes
    User ||--o{ SellerSubscription : has
    
    Building ||--o{ Unit : contains
    Building ||--|| BuildingSetting : configures
    Building ||--o{ Listing : hosts
    Building ||--o{ Category : has
    
    Listing ||--o{ Order : generates
    Listing ||--o{ Booking : generates
    Listing }o--|| Category : belongs_to
    Listing ||--o{ Review : receives
    
    Order ||--o{ Message : discusses
    Order ||--|| Transaction : pays
    Order ||--o| Review : reviewed_by
    
    Booking ||--o{ Message : discusses
    Booking ||--|| Transaction : pays
    Booking ||--o| Review : reviewed_by
    
    SellerSubscription }o--|| SubscriptionPlan : uses
    
    User ||--o{ ModerationAction : receives
    User ||--o{ Report : submits
    Listing ||--o{ Report : reported
```

**Core Models**:
- `User`, `UserProfile`: Authentication and user data
- `Building`, `Unit`, `BuildingSetting`: Multi-tenant architecture
- `VerificationRequest`: Unit and building verification

**Marketplace Models**:
- `Listing`, `Category`: Product and service listings
- `Order`, `Booking`: Transactions and appointments
- `Transaction`: Payment tracking

**Subscription Models**:
- `SubscriptionPlan`: Plan definitions (FREE, STANDARD, PREMIUM)
- `SellerSubscription`: Active subscriptions with limits

**Communication Models**:
- `ChatRoom`, `Message`: Real-time messaging
- `Notification`: Email notification tracking

**Reputation Models**:
- `Review`: User reviews and ratings
- `Reputation`: Aggregated reputation scores

**Moderation Models**:
- `Report`: User-submitted reports
- `ModerationAction`: Admin actions (warnings, bans)
- `BlockedUser`: User blocking relationships

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

## 🔒 Security Features

- **Firebase Authentication**: Industry-standard authentication
- **JWT Tokens**: Short-lived access tokens + refresh tokens
- **Role-Based Access Control (RBAC)**: Fine-grained permissions
- **Building Isolation**: Data segregation between buildings
- **Rate Limiting**: Protection against abuse
- **Input Validation**: DTO validation with class-validator
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Protection**: Helmet middleware
- **CORS Configuration**: Controlled cross-origin access
- **Secure Headers**: Security headers via Helmet

## 📈 Performance Optimizations

- **Redis Caching**: Distributed caching for frequently accessed data
- **Database Indexing**: Optimized queries with strategic indexes
- **Connection Pooling**: Efficient database connections
- **Pagination**: Limit result sets for better performance
- **Lazy Loading**: Load relationships only when needed
- **Query Optimization**: Prisma query optimization
- **Compression**: Response compression middleware

## 🧪 Testing Strategy

```bash
# Unit tests for individual components
pnpm test

# E2E tests for complete workflows
pnpm test:e2e

# Test coverage reporting
pnpm test:cov
```

**Test Coverage**:
- Unit tests for services and utilities
- E2E tests for critical user flows
- Integration tests for database operations
- Mock external services (Firebase, Redis)

## 📊 Monitoring & Analytics

**Available Analytics Endpoints**:
- Platform Analytics: System-wide metrics
- Building Analytics: Per-building statistics
- Seller Analytics: Individual seller performance

**Health Monitoring**:
- `/health`: Overall system health
- `/health/liveness`: Container liveness
- `/health/readiness`: Service readiness

**Metrics Tracked**:
- Request/response times
- Error rates
- Cache hit rates
- Database query performance
- Memory usage
- Active connections

## 🌍 Deployment

### Production Deployment

```bash
# Build the application
pnpm build

# Run migrations
npx prisma migrate deploy

# Start production server
NODE_ENV=production pnpm start:prod
```

### Docker Deployment

```bash
# Build production image
docker build --target production -t condomarket-api:latest .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Configuration

Ensure all required environment variables are set:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: JWT secrets
- `FIREBASE_*`: Firebase credentials
- `SMTP_*`: Email service configuration

## 📝 License

[UNLICENSED]

## 🔗 Links

- **API Documentation**: [https://api.condomarket.v2dev.xyz/reference](https://api.condomarket.v2dev.xyz/reference)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Development Plan](./DEVELOPMENT_PLAN.md)
- [Redis Caching Guide](./REDIS_CACHING.md)
- [Firebase Setup](./FIREBASE_SETUP.md)

## 📊 Project Status

✅ **Completed Features**:
- Authentication & Authorization with Firebase
- User Management & Profiles
- Multi-Building Architecture
- Building Verification System
- Marketplace Listings (Products & Services)
- Orders & Bookings Management
- Subscription System (FREE, STANDARD, PREMIUM)
- Real-time Chat with WebSocket
- Email Notifications
- Reviews & Reputation System
- Content Moderation & Reporting
- User Blocking
- Redis Caching Infrastructure
- Analytics Dashboards
- Health Monitoring
- Docker Support

🚀 **Production Ready**: All core features implemented and tested
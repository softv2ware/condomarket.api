# CondoMarket API - Development Plan

## Overview
This development plan breaks down the CondoMarket marketplace application into 8 comprehensive stages. Each stage is designed to be completed 100% before moving to the next, ensuring a solid foundation and incremental, testable progress toward a production-ready backend.

---

## Stage 1: Foundation & Infrastructure Setup ✅ (PARTIALLY COMPLETE)

### Objectives
- Set up the core NestJS project structure
- Configure database with Prisma
- Implement authentication & authorization
- Set up API documentation with Swagger/Scalar
- Configure environment variables and logging

### Tasks
- [x] Initialize NestJS project with TypeScript
- [x] Install and configure Prisma ORM
- [x] Set up Swagger with Scalar for API documentation
- [ ] Configure environment variables (.env, validation)
- [ ] Set up logging infrastructure (Winston or Pino)
- [ ] Implement JWT-based authentication module
- [ ] Create authentication guards and decorators
- [ ] Set up role-based access control (RBAC) decorators
- [ ] Configure CORS and security headers (helmet)
- [ ] Set up error handling and exception filters
- [ ] Configure database connection pooling
- [ ] Set up health check endpoints
- [ ] Configure Docker and docker-compose for development

### Deliverables
- Working NestJS application with proper structure
- Database configured and connectable
- Authentication endpoints (register, login, refresh token)
- API documentation accessible at /reference
- Docker setup for local development
- README with setup instructions

### Testing
- Unit tests for auth service
- E2E tests for auth endpoints
- Integration tests for database connection

---

## Stage 2: Core User & Building Management

### Objectives
- Implement multi-building architecture
- Create user profiles and resident verification system
- Build admin role hierarchy (Platform Admin, Building Admin)
- Implement building and unit management

### Database Schema
```prisma
- User (id, email, phone, password, role, status, createdAt, updatedAt)
- Building (id, name, address, type, status, createdAt, updatedAt)
- Unit (id, buildingId, unitNumber, floor, type)
- ResidentBuilding (id, userId, buildingId, unitId, verificationMethod, verificationStatus, verifiedAt, verifiedBy)
- InvitationCode (id, buildingId, code, usedBy, expiresAt, createdBy)
- UserProfile (userId, firstName, lastName, bio, profilePictureUrl, privacySettings)
```

### API Endpoints
**Users Module:**
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh token
- `GET /users/me` - Get current user profile
- `PATCH /users/me` - Update profile
- `POST /users/me/verify-residence` - Submit verification request

**Buildings Module:**
- `POST /buildings` - Create building (Platform Admin)
- `GET /buildings` - List all buildings (Platform Admin)
- `GET /buildings/:id` - Get building details
- `PATCH /buildings/:id` - Update building (Platform/Building Admin)
- `DELETE /buildings/:id` - Soft delete building (Platform Admin)
- `POST /buildings/:id/units` - Add units (Building Admin)
- `GET /buildings/:id/units` - List units

**Verification Module:**
- `POST /verification/invitation-codes` - Generate invitation codes (Building Admin)
- `POST /verification/verify-with-code` - Verify with invitation code
- `POST /verification/verify-with-unit` - Verify with unit + last name
- `GET /verification/pending` - List pending verifications (Building Admin)
- `POST /verification/:id/approve` - Approve verification (Building Admin)
- `POST /verification/:id/reject` - Reject verification (Building Admin)

### Business Logic
- Email/phone uniqueness validation
- Password hashing with bcrypt
- Building-scoped data isolation
- Three verification methods implementation
- Admin hierarchy (Platform Admin > Building Admin > Resident)
- Resident status management (PENDING, VERIFIED, SUSPENDED)

### Testing
- Unit tests for all services
- E2E tests for complete verification flows
- Tests for access control (residents can't see other buildings' data)
- Tests for admin permissions

### Deliverables
- Complete user management system
- Working verification system with all three methods
- Admin panels foundation
- Building and unit CRUD operations
- Comprehensive test coverage (>80%)

---

## Stage 3: Subscription Plans & Seller Management

### Objectives
- Implement seller subscription system (FREE, STANDARD, PREMIUM)
- Create subscription lifecycle management
- Build subscription admin panel
- Implement listing limits enforcement

### Database Schema
```prisma
- SubscriptionPlan (id, name, tier, description, monthlyPrice, currency, maxActiveListings, sortPriority, isHighlightEnabled, isDefaultFree, buildingId?)
- SellerSubscription (id, userId, buildingId, planId, status, startDate, endDate, renewsAt, lastPaymentStatus, createdAt, updatedAt)
- PaymentMethod (id, userId, type, provider, externalId, isDefault)
- SubscriptionPayment (id, subscriptionId, amount, currency, status, paidAt, failureReason)
- SubscriptionLog (id, subscriptionId, action, oldStatus, newStatus, metadata, createdAt)
```

### API Endpoints
**Subscription Plans Module:**
- `POST /subscription-plans` - Create plan (Platform Admin)
- `GET /subscription-plans` - List all plans
- `GET /subscription-plans/:id` - Get plan details
- `PATCH /subscription-plans/:id` - Update plan (Platform Admin)
- `DELETE /subscription-plans/:id` - Delete plan (Platform Admin)
- `GET /buildings/:buildingId/subscription-plans` - Get plans for building

**Seller Subscriptions Module:**
- `POST /seller-subscriptions` - Subscribe to a plan (Seller)
- `GET /seller-subscriptions/me` - Get my subscriptions
- `GET /seller-subscriptions/:id` - Get subscription details
- `PATCH /seller-subscriptions/:id/cancel` - Cancel subscription
- `PATCH /seller-subscriptions/:id/change-plan` - Upgrade/downgrade plan
- `POST /seller-subscriptions/:id/retry-payment` - Retry failed payment

**Admin Subscription Management:**
- `GET /admin/subscriptions` - List all subscriptions (Building/Platform Admin)
- `GET /admin/subscriptions/stats` - Subscription statistics
- `POST /admin/subscriptions/:id/override` - Manual subscription override (Platform Admin)

### Business Logic
- Default FREE plan assignment on user creation
- Subscription tier enforcement (1 listing for FREE, unlimited for others)
- Automatic downgrade on payment failure after grace period
- Subscription renewal logic with retry mechanism
- Plan change handling (immediate upgrade, end-of-period downgrade)
- Listing limit validation before activation
- Excess listing handling on downgrade (auto-pause all but one)
- Subscription audit logging

### Background Jobs
- Daily subscription renewal checks
- Payment retry mechanism (3 attempts over 7 days)
- Grace period expiration processor
- Subscription metrics aggregation

### Testing
- Unit tests for subscription service logic
- Tests for listing limit enforcement
- Tests for subscription lifecycle transitions
- Tests for payment failure and retry scenarios
- E2E tests for complete subscription flows

### Deliverables
- Complete subscription system
- Subscription admin dashboard endpoints
- Payment tracking (off-platform for MVP)
- Automated subscription lifecycle management
- Background job infrastructure
- Comprehensive audit logs

---

## Stage 4: Marketplace Listings (Products & Services)

### Objectives
- Implement product and service listings
- Create listing moderation workflow
- Build search and discovery features
- Implement subscription-based highlighting and ranking

### Database Schema
```prisma
- Listing (id, sellerId, buildingId, type, title, slug, description, category, price, currency, status, subscriptionTierSnapshot, availabilityType, pickupLocation, deliveryAvailable, durationMinutes, createdAt, updatedAt, publishedAt, viewCount, orderCount)
- ListingPhoto (id, listingId, url, order, isMain)
- ListingAvailability (id, listingId, dayOfWeek, startTime, endTime) // for services
- Category (id, name, slug, type, description, icon, parentId, buildingId?)
- ListingView (id, listingId, userId, viewedAt) // for analytics
- SavedListing (id, userId, listingId, savedAt) // favorites
```

### API Endpoints
**Listings Module:**
- `POST /listings` - Create listing (Seller)
- `GET /listings` - Browse listings with filters
- `GET /listings/:id` - Get listing details
- `PATCH /listings/:id` - Update listing (Seller)
- `DELETE /listings/:id` - Soft delete listing (Seller)
- `PATCH /listings/:id/publish` - Publish draft listing
- `PATCH /listings/:id/pause` - Pause active listing
- `PATCH /listings/:id/activate` - Reactivate paused listing
- `POST /listings/:id/photos` - Upload photos
- `DELETE /listings/:id/photos/:photoId` - Delete photo
- `GET /listings/:id/availability` - Get service availability
- `PUT /listings/:id/availability` - Update service availability

**Search & Discovery:**
- `GET /search/listings` - Advanced search with filters
- `GET /listings/featured` - Get highlighted/premium listings
- `GET /listings/categories/:categorySlug` - Browse by category
- `GET /listings/nearby` - Listings in my building
- `POST /listings/:id/save` - Save listing to favorites
- `GET /listings/saved` - Get saved listings

**Moderation (Building Admin):**
- `GET /admin/listings/pending` - Pending approval queue
- `POST /admin/listings/:id/approve` - Approve listing
- `POST /admin/listings/:id/reject` - Reject listing with reason
- `GET /admin/listings/stats` - Listing statistics

**Categories Module:**
- `POST /categories` - Create category (Platform Admin)
- `GET /categories` - List categories (with building filtering)
- `PATCH /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

### Business Logic
- Listing status workflow (DRAFT → PENDING_APPROVAL → ACTIVE)
- Building-scoped listing isolation
- Subscription tier enforcement (FREE = 1 listing max)
- Listing activation validation (check subscription limits)
- Automatic pending approval if building has moderation enabled
- Photo upload with validation (size, format, max count)
- Slug generation for SEO-friendly URLs
- View tracking for analytics
- Subscription-based ranking algorithm:
  - Sort priority: PREMIUM > STANDARD > FREE
  - Within tier: relevance, rating, recency
  - Premium highlighting (badge, special styling indicators)

### Search Implementation
- Full-text search on title and description
- Filters: category, type, price range, availability
- Building-scoped search (only own building)
- Elasticsearch or PostgreSQL full-text search
- Caching for popular searches

### Testing
- Unit tests for listing service
- Tests for subscription limit enforcement
- Tests for status transitions
- Tests for moderation workflow
- Search and filtering tests
- Tests for ranking algorithm
- E2E tests for complete listing lifecycle

### Deliverables
- Complete listing management system
- Working moderation workflow
- Advanced search and filtering
- Subscription-based highlighting
- Photo upload and management
- Category system
- Analytics tracking foundation

---

## Stage 5: Orders, Bookings & Transactions

### Objectives
- Implement product orders system
- Implement service bookings system
- Create order/booking lifecycle management
- Build transaction tracking (off-platform payments for MVP)

### Database Schema
```prisma
- Order (id, listingId, buyerId, sellerId, buildingId, type, status, quantity, totalPrice, currency, deliveryMethod, pickupLocation, deliveryAddress, scheduledFor, createdAt, updatedAt, confirmedAt, completedAt, cancelledAt, cancellationReason)
- OrderStatusHistory (id, orderId, status, changedBy, reason, createdAt)
- Booking (id, listingId, serviceId, buyerId, sellerId, buildingId, status, startTime, endTime, durationMinutes, totalPrice, currency, location, notes, createdAt, updatedAt, confirmedAt, completedAt, cancelledAt, cancellationReason)
- BookingStatusHistory (id, bookingId, status, changedBy, reason, createdAt)
- Transaction (id, orderId?, bookingId?, amount, currency, paymentMethod, status, paidAt, metadata) // off-platform tracking
```

### API Endpoints
**Orders Module (Products):**
- `POST /orders` - Create order (Buyer)
- `GET /orders` - List my orders (buyer/seller view)
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id/confirm` - Confirm order (Seller)
- `PATCH /orders/:id/ready-for-pickup` - Mark ready (Seller)
- `PATCH /orders/:id/out-for-delivery` - Mark out for delivery (Seller)
- `PATCH /orders/:id/complete` - Mark completed (Seller/System)
- `PATCH /orders/:id/cancel` - Cancel order (Buyer/Seller)
- `GET /orders/:id/history` - Get status history

**Bookings Module (Services):**
- `POST /bookings` - Request booking (Buyer)
- `GET /bookings` - List my bookings
- `GET /bookings/:id` - Get booking details
- `PATCH /bookings/:id/confirm` - Confirm booking (Seller)
- `PATCH /bookings/:id/start` - Mark in progress (Seller)
- `PATCH /bookings/:id/complete` - Mark completed (Seller)
- `PATCH /bookings/:id/cancel` - Cancel booking
- `PATCH /bookings/:id/no-show` - Mark no-show (Seller)
- `GET /bookings/:id/history` - Get status history
- `GET /bookings/availability/:listingId` - Check available time slots

**Transactions Module:**
- `POST /orders/:id/payment` - Record payment (off-platform)
- `POST /bookings/:id/payment` - Record payment (off-platform)
- `GET /transactions` - List my transactions
- `GET /transactions/:id` - Get transaction details

### Business Logic
**Product Orders:**
- Status flow: PENDING_CONFIRMATION → CONFIRMED → READY_FOR_PICKUP/OUT_FOR_DELIVERY → COMPLETED
- Alternative flows: CANCELLED, EXPIRED
- Auto-expire if not confirmed within 48 hours
- Seller must confirm before buyer can proceed
- Quantity validation against listing
- Building-scoped (buyer and seller in same building)

**Service Bookings:**
- Status flow: REQUESTED → CONFIRMED → IN_PROGRESS → COMPLETED
- Alternative flows: CANCELLED, NO_SHOW
- Time slot conflict validation
- Auto-cancel if not confirmed within 24 hours
- Booking overlap prevention for seller
- Duration and pricing calculation

**General Transaction Logic:**
- Payment method tracking (cash, transfer, etc.)
- Transaction status (PENDING, COMPLETED, FAILED)
- Order/booking linkage
- Audit trail for all status changes
- Notification triggers on status changes

### Background Jobs
- Auto-expire pending orders (48h)
- Auto-cancel unconfirmed bookings (24h)
- Reminder notifications (upcoming bookings)
- Completion reminders (3 days after delivery/service)

### Notifications
- Order placed (to seller)
- Order confirmed (to buyer)
- Order ready (to buyer)
- Booking requested (to seller)
- Booking confirmed (to buyer)
- Booking reminder (1 hour before)
- Completion prompts

### Testing
- Unit tests for order/booking services
- Tests for state machine transitions
- Tests for auto-expiration logic
- Tests for time slot conflicts
- Tests for validation rules
- E2E tests for complete order/booking flows
- Concurrent booking conflict tests

### Deliverables
- Complete order management system
- Complete booking management system
- Transaction tracking (off-platform)
- Status history and audit trails
- Auto-expiration and reminders
- Notification integration points

---

## Stage 6: Communication & Reviews

### Objectives
- Implement order/booking chat system
- Create ratings and reviews system
- Build notification infrastructure
- Implement real-time messaging

### Database Schema
```prisma
- ChatThread (id, orderId?, bookingId?, participantIds, lastMessageAt, createdAt)
- Message (id, threadId, senderId, content, type, metadata, readBy, sentAt, editedAt, deletedAt)
- Review (id, orderId?, bookingId?, reviewerId, revieweeId, listingId, rating, comment, response, type, status, createdAt, respondedAt)
- Notification (id, userId, type, title, message, data, readAt, sentAt, channels)
- NotificationPreference (userId, channel, type, enabled)
```

### API Endpoints
**Chat Module:**
- `GET /chats` - List my chat threads
- `GET /chats/:threadId` - Get chat thread with messages
- `POST /chats/:threadId/messages` - Send message
- `PATCH /chats/:threadId/messages/:id` - Edit message
- `DELETE /chats/:threadId/messages/:id` - Delete message
- `PATCH /chats/:threadId/read` - Mark thread as read
- `GET /chats/unread-count` - Get unread count

**Reviews Module:**
- `POST /reviews` - Create review (after order/booking completion)
- `GET /reviews` - List reviews (filter by user, listing, type)
- `GET /reviews/:id` - Get review details
- `PATCH /reviews/:id/respond` - Respond to review (reviewee)
- `PATCH /reviews/:id/edit` - Edit review (within 24h)
- `POST /reviews/:id/report` - Report review
- `GET /listings/:id/reviews` - Get listing reviews
- `GET /users/:id/reviews` - Get user reviews (as seller/buyer)
- `GET /users/:id/rating-summary` - Get rating statistics

**Notifications Module:**
- `GET /notifications` - List my notifications
- `GET /notifications/unread-count` - Get unread count
- `PATCH /notifications/:id/read` - Mark as read
- `PATCH /notifications/read-all` - Mark all as read
- `GET /notifications/preferences` - Get notification preferences
- `PATCH /notifications/preferences` - Update preferences

### Business Logic
**Chat:**
- One chat thread per order/booking
- Only order/booking participants can access thread
- Message editing allowed within 15 minutes
- Soft delete for messages
- Read receipts tracking
- Support for text and system messages (status updates)

**Reviews:**
- Only one review per order/booking per user
- Reviews unlocked only after COMPLETED status
- Rating scale 1-5 stars
- Optional comment (max 500 chars)
- Seller can respond to reviews
- Review editing allowed within 24 hours
- Calculate average ratings for users and listings
- Review moderation (can be reported and removed)

**Notifications:**
- Multi-channel (in-app, push, email)
- User preferences per notification type
- Batch processing for bulk notifications
- Priority levels (low, medium, high, urgent)
- Notification types: registration, verification, order, booking, chat, review, subscription
- Template system for consistent messaging

### Real-time Features
- WebSocket connection for chat
- Real-time notification delivery
- Online/offline status indicators
- Typing indicators (optional)

### Testing
- Unit tests for chat service
- Tests for review creation and validation
- Tests for rating calculation
- Tests for notification delivery
- Integration tests for WebSocket connections
- E2E tests for complete communication flows

### Deliverables
- Complete chat system with real-time messaging
- Rating and review system
- Notification infrastructure
- User preferences management
- WebSocket implementation
- Email notification templates

---

## Stage 7: Moderation, Reporting & Safety

### Objectives
- Implement comprehensive reporting system
- Build moderation tools for admins
- Create content safety features
- Implement user reputation system

### Database Schema
```prisma
- Report (id, reporterId, reportType, entityType, entityId, reason, description, status, reviewedBy, reviewedAt, resolution, createdAt)
- ModerationAction (id, targetType, targetId, actionType, performedBy, reason, metadata, expiresAt, createdAt)
- UserReputation (userId, sellerRating, buyerRating, totalOrders, totalBookings, completionRate, responseTime, responseRate, reliabilityScore, lastCalculatedAt)
- BlockedUser (id, blockerId, blockedId, reason, createdAt)
- BuildingSettings (buildingId, requireListingApproval, allowedCategories, maxListingsPerSeller, autoModeration, settings)
```

### API Endpoints
**Reporting Module:**
- `POST /reports` - Create report
- `GET /reports` - List my reports
- `GET /reports/:id` - Get report details
- `GET /admin/reports` - List all reports (Admin)
- `GET /admin/reports/pending` - Pending reports queue
- `PATCH /admin/reports/:id/review` - Review report
- `PATCH /admin/reports/:id/resolve` - Resolve report
- `PATCH /admin/reports/:id/escalate` - Escalate to Platform Admin

**Moderation Module (Building/Platform Admin):**
- `POST /moderation/warn` - Warn user
- `POST /moderation/restrict` - Restrict user actions
- `POST /moderation/suspend` - Suspend user
- `POST /moderation/ban` - Ban user (Platform Admin)
- `POST /moderation/remove-content` - Remove listing/review/message
- `GET /moderation/actions` - List moderation actions
- `GET /moderation/history/:userId` - User moderation history

**Building Settings Module:**
- `GET /buildings/:id/settings` - Get building settings
- `PATCH /buildings/:id/settings` - Update settings (Building Admin)
- `GET /buildings/:id/moderation-stats` - Moderation statistics

**Reputation Module:**
- `GET /users/:id/reputation` - Get user reputation
- `POST /admin/reputation/recalculate` - Trigger recalculation

**Blocking Module:**
- `POST /blocks` - Block a user
- `GET /blocks` - List blocked users
- `DELETE /blocks/:id` - Unblock user

### Business Logic
**Reporting:**
- Report types: LISTING, USER, REVIEW, MESSAGE, ORDER, BOOKING
- Report reasons: INAPPROPRIATE, SCAM, HARASSMENT, SPAM, FAKE, OTHER
- Building Admin reviews building-level reports
- Platform Admin reviews escalated and cross-building reports
- Auto-hide content after threshold of reports (configurable)
- Reporter anonymity protection

**Moderation Actions:**
- WARNING: sends notification, recorded in history
- RESTRICTION: limits actions (can't create listings, can't message)
- SUSPENSION: temporary account freeze (7, 30, 90 days)
- BAN: permanent removal (Platform Admin only)
- CONTENT_REMOVAL: removes listing, review, or message
- Moderation actions create audit trail
- Automatic expiration for temporary actions

**Reputation System:**
- Seller metrics: avg rating, completion rate, response time
- Buyer metrics: avg rating, payment reliability, cancellation rate
- Overall reliability score (0-100)
- Badge system for trusted sellers
- Recalculated after each completed transaction
- Impacts search ranking and trust indicators

**Building Settings:**
- Toggle listing approval requirement
- Configure allowed/disallowed categories
- Set max listings per seller
- Enable/disable auto-moderation
- Custom verification rules
- Community guidelines

### Background Jobs
- Daily reputation recalculation
- Expired moderation actions cleanup
- Report aggregation for spam detection
- Suspicious activity detection patterns

### Testing
- Unit tests for reporting logic
- Tests for moderation actions
- Tests for reputation calculation
- Tests for content auto-hiding
- Tests for admin permission boundaries
- E2E tests for complete moderation workflows

### Deliverables
- Complete reporting system
- Moderation tools for all admin levels
- User reputation system
- Building settings management
- Content safety features
- Moderation audit trails
- Automated safety mechanisms

---

## Stage 8: Production Readiness & Optimization

### Objectives
- Implement comprehensive monitoring and logging
- Add performance optimizations
- Set up CI/CD pipeline
- Prepare for scalability
- Complete security hardening
- Create admin analytics dashboards

### Tasks

**Monitoring & Observability:**
- [ ] Set up APM (Application Performance Monitoring) - New Relic/DataDog
- [ ] Implement structured logging with correlation IDs
- [ ] Add request/response logging middleware
- [ ] Set up error tracking (Sentry)
- [ ] Create custom metrics and dashboards
- [ ] Implement health checks for all dependencies
- [ ] Set up uptime monitoring
- [ ] Create alerting rules for critical issues

**Performance Optimization:**
- [ ] Implement Redis caching for frequently accessed data
- [ ] Add database query optimization and indexing
- [ ] Implement pagination for all list endpoints
- [ ] Add rate limiting per user/IP
- [ ] Optimize image upload and storage (CDN)
- [ ] Implement database connection pooling
- [ ] Add lazy loading for relationships
- [ ] Profile and optimize slow endpoints
- [ ] Implement API response compression

**Search Optimization:**
- [ ] Set up Elasticsearch or PostgreSQL full-text search
- [ ] Implement search result caching
- [ ] Add search analytics
- [ ] Optimize search ranking algorithm
- [ ] Implement search suggestions/autocomplete

**Security Hardening:**
- [ ] Complete security audit
- [ ] Implement rate limiting and DDoS protection
- [ ] Add request validation schemas (class-validator)
- [ ] Implement CSRF protection
- [ ] Add SQL injection prevention
- [ ] Implement XSS protection
- [ ] Set up security headers (helmet)
- [ ] Add API versioning
- [ ] Implement API key management for admin tools
- [ ] Set up secrets management (AWS Secrets Manager/Vault)
- [ ] Configure SSL/TLS properly
- [ ] Implement audit logging for sensitive operations

**CI/CD Pipeline:**
- [ ] Set up GitHub Actions / GitLab CI
- [ ] Automated testing on PR
- [ ] Automated linting and formatting checks
- [ ] Automated security scanning
- [ ] Automated database migration checks
- [ ] Build and push Docker images
- [ ] Automated deployment to staging
- [ ] Manual approval for production deployment
- [ ] Rollback mechanism

**Database:**
- [ ] Set up automated backups
- [ ] Implement backup restoration testing
- [ ] Configure read replicas for scalability
- [ ] Set up database monitoring
- [ ] Optimize indexes based on query patterns
- [ ] Implement data retention policies
- [ ] Set up database migration rollback strategy

**Analytics Dashboard APIs:**
```
Platform Admin Dashboard:
- GET /admin/analytics/overview - Global KPIs
- GET /admin/analytics/buildings - Building statistics
- GET /admin/analytics/users - User growth and activity
- GET /admin/analytics/listings - Listing statistics
- GET /admin/analytics/transactions - Transaction volume and revenue
- GET /admin/analytics/subscriptions - Subscription metrics

Building Admin Dashboard:
- GET /buildings/:id/analytics/overview - Building KPIs
- GET /buildings/:id/analytics/residents - Resident statistics
- GET /buildings/:id/analytics/listings - Listing performance
- GET /buildings/:id/analytics/transactions - Transaction statistics
- GET /buildings/:id/analytics/top-sellers - Top performing sellers
- GET /buildings/:id/analytics/categories - Category distribution

Seller Dashboard:
- GET /seller/analytics/overview - Seller KPIs
- GET /seller/analytics/listings - Listing performance
- GET /seller/analytics/orders - Order statistics
- GET /seller/analytics/revenue - Revenue tracking
- GET /seller/analytics/reviews - Review summary
```

**Documentation:**
- [ ] Complete API documentation (Swagger/Scalar)
- [ ] Create deployment guide
- [ ] Write database migration guide
- [ ] Document environment variables
- [ ] Create admin user guide
- [ ] Write developer onboarding guide
- [ ] Document architecture decisions
- [ ] Create runbooks for common issues
- [ ] Document backup and recovery procedures

**Infrastructure as Code:**
- [ ] Set up Terraform/Pulumi for infrastructure
- [ ] Configure production environment (AWS/GCP/Azure)
- [ ] Set up staging environment
- [ ] Configure auto-scaling groups
- [ ] Set up load balancers
- [ ] Configure CDN for static assets
- [ ] Set up VPC and security groups
- [ ] Configure database clusters

**Testing & Quality:**
- [ ] Achieve >80% code coverage
- [ ] Load testing (Artillery/k6)
- [ ] Stress testing
- [ ] Security penetration testing
- [ ] API contract testing
- [ ] Integration testing for all modules
- [ ] E2E testing for critical user journeys
- [ ] Performance regression testing

**Final Touches:**
- [ ] Implement graceful shutdown
- [ ] Add feature flags system
- [ ] Set up blue-green deployment
- [ ] Create disaster recovery plan
- [ ] Implement data export functionality (GDPR)
- [ ] Add API deprecation mechanism
- [ ] Set up changelog/release notes automation
- [ ] Create status page for API health

### Deliverables
- Production-ready application
- Complete monitoring and alerting setup
- Optimized performance (sub-200ms average response time)
- Automated CI/CD pipeline
- Comprehensive documentation
- Security-hardened infrastructure
- Scalable architecture
- Complete test coverage
- Admin analytics dashboards

---

## Success Criteria

### Stage 1 Complete When:
- ✅ Authentication works end-to-end with JWT
- ✅ Database connected and migrations running
- ✅ API documentation accessible
- ✅ Docker setup functional
- ✅ All tests passing

### Stage 2 Complete When:
- ✅ Users can register and verify residence through all three methods
- ✅ Building admins can manage their buildings
- ✅ Platform admins can manage all buildings
- ✅ Data isolation between buildings verified
- ✅ >80% test coverage

### Stage 3 Complete When:
- ✅ Sellers can subscribe to plans
- ✅ Subscription limits enforced correctly
- ✅ Automatic renewals and downgrades working
- ✅ Subscription admin panel functional
- ✅ All subscription states tested

### Stage 4 Complete When:
- ✅ Listings can be created and moderated
- ✅ Search and filtering fully functional
- ✅ Subscription-based highlighting working
- ✅ Photo uploads working
- ✅ Listing limits enforced by subscription

### Stage 5 Complete When:
- ✅ Complete order flow working (product)
- ✅ Complete booking flow working (service)
- ✅ Auto-expiration jobs running
- ✅ Transaction tracking functional
- ✅ State machine transitions validated

### Stage 6 Complete When:
- ✅ Real-time chat functional
- ✅ Reviews and ratings working
- ✅ Notifications sent on all key events
- ✅ WebSocket connections stable
- ✅ Rating calculations accurate

### Stage 7 Complete When:
- ✅ Reporting system fully functional
- ✅ Moderation tools working for all admin levels
- ✅ Reputation system calculating correctly
- ✅ Content safety features active
- ✅ Building settings configurable

### Stage 8 Complete When:
- ✅ Application deployed to production
- ✅ Monitoring and alerts configured
- ✅ Performance targets met (<200ms avg)
- ✅ Load testing passed (1000+ concurrent users)
- ✅ Security audit completed
- ✅ All documentation complete
- ✅ CI/CD pipeline fully automated

---

## Timeline Estimate

- **Stage 1:** 1-2 weeks
- **Stage 2:** 2-3 weeks
- **Stage 3:** 2 weeks
- **Stage 4:** 3 weeks
- **Stage 5:** 3 weeks
- **Stage 6:** 2-3 weeks
- **Stage 7:** 2 weeks
- **Stage 8:** 2-3 weeks

**Total:** ~17-21 weeks (4-5 months)

---

## Technology Stack

**Core:**
- NestJS (Framework)
- TypeScript
- Prisma (ORM)
- PostgreSQL (Database)
- Redis (Caching, Sessions)

**Authentication:**
- JWT (Access & Refresh Tokens)
- bcrypt (Password Hashing)
- Passport.js

**Real-time:**
- Socket.io / WebSockets
- Redis (Pub/Sub for scaling)

**Search:**
- PostgreSQL Full-Text Search (MVP)
- Elasticsearch (Future)

**File Storage:**
- AWS S3 / Cloudinary
- Multer for uploads

**Monitoring:**
- Winston/Pino (Logging)
- Sentry (Error Tracking)
- New Relic/DataDog (APM)

**Testing:**
- Jest (Unit & Integration)
- Supertest (E2E)
- Artillery/k6 (Load Testing)

**Infrastructure:**
- Docker & Docker Compose
- GitHub Actions (CI/CD)
- AWS/GCP (Production)
- Terraform (IaC)

---

## Notes

1. Each stage should be completed 100% with full test coverage before moving to the next
2. Database migrations should be reviewable and rollback-able
3. API changes should maintain backward compatibility
4. Security should be considered at every stage
5. Performance should be monitored from Stage 1
6. Documentation should be updated with each stage
7. Code reviews required before merging to main
8. Staging deployment before production for each stage

---

## Current Status

- ✅ Stage 1: In Progress (Swagger + Scalar configured)
- ⏳ Next: Complete Stage 1 foundation tasks

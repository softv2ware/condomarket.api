# Marketplace App for Buildings &

# Apartment Complexes

## Business Logic & Functional Requirements

## 1. Product Overview

### Purpose

The app is a closed marketplace for residents of a building or apartment complex. It allows them to
offer products (second-hand items, homemade food, crafts) and services (cleaning, babysitting,
tutoring, pet walking) and to discover, buy, book, and review these offers within their residential
community.

Main goals:

- Facilitate trust-based local commerce inside the complex.
- Increase sense of community.
- Provide extra income opportunities for residents.
- Give building administrators control & visibility over what is offered.

### Scope

The platform supports multiple buildings and complexes, user verification per building, listing
management (products and services), search and filtering, orders and bookings, optional payments,
ratings and reviews, internal messaging, administration with moderation tools, and optional seller
subscription tiers for highlighted placement and posting limits.


## 2. Stakeholders & Roles

```
There are several user types interacting with the system. The following table summarizes their main
capabilities.
```
Role Description Key Capabilities

Guest Unauthenticated user, outside the community.View marketing information only; cannot access internal marketplace.

Resident Verified member of a specific building.Browse and search listings, create orders/bookings, chat, give ratings & reviews.

Seller (Resident Seller)Resident who publishes listings. Create and manage listings, confirm orders and bookings, coordinate with buyers, optionally subscribe to paid plans.

Building Admin Administrator of a single building or complex.Verify residents, approve/reject listings, moderate content, see building metrics, configure local subscription options.

Platform Admin Global platform owner. Manage buildings, building admins, global settings, subscription products, and severe moderation actions.

System / AutomationBackground processes. Send notifications, cleanup tasks, auto-cancel or auto-complete orders when rules apply, enforce subscription limits and expiries.

### High-Level Roles Diagram (Conceptual)

```
Building Admins manage Residents and Listings within a Building, while the Platform Admin
manages multiple Buildings and their Admins. Residents interact with each other through Listings,
Orders, Chats, and optional Subscription Plans that affect how their listings are displayed.
```

## 3. Onboarding & Access Control

### Building & Complex Structure

```
Each Building or Complex has a name, address, type (tower, gated community, etc.), and a list of
units. Buildings can be grouped into larger complexes if needed.
```
### Resident Registration & Verification

```
Residents register with email/phone and password, select their building and unit, and must be
verified by one of the allowed methods (invitation code, unit code + last name, or manual approval
by Building Admin). Until verified, a user has restricted access and cannot see internal listings or
create orders.
```
Method Description

Invitation Code Building Admin issues unique invitation codes. Residents enter a valid code to verify.

Unit Code + Last Name Resident matches a preloaded unit and partial resident data for semi-automatic verification.

Manual Approval Resident request is queued and Building Admin manually approves or rejects.


## 4. User Profiles

```
Resident profiles contain name, apartment/unit, contact information, profile picture, bio, and
seller-specific fields like accepted payment methods, rating summary, and current subscription tier
(FREE, STANDARD, PREMIUM). Users may configure privacy settings for what is visible to other
residents (e.g., masking unit number or phone).
```
## 5. Marketplace Listings

```
Listings are scoped to a single building and can be of type PRODUCT or SERVICE. They include
title, description, category, photos, price, availability, pickup/delivery options, and status flags like
DRAFT, ACTIVE, PAUSED, PENDING_APPROVAL, etc. Subscription tier can influence whether a
listing is highlighted and how it is sorted.
```
Status Meaning

DRAFT Listing saved but not visible to others.

PENDING_APPROVAL Waiting for Building Admin review when moderation is enabled.

ACTIVE Visible and can receive orders or bookings.

PAUSED Temporarily hidden, cannot receive new orders.

REJECTED Rejected by admin with a reason.

ARCHIVED Permanently inactive, kept only for history.


## 6. Search, Browse & Discovery

```
Residents can browse all listings for their building, filter by category, type (product/service), price,
availability, and sort by newest, price, or rating. Search supports free text over titles and
descriptions with category and price filters. Subscription tiers affect listing ordering and highlighting
within these results.
```
## 7. Orders & Bookings

```
Orders and bookings connect buyers with sellers. Products involve quantity and optional delivery;
services involve time slots and durations. Each order or booking has a defined life cycle with distinct
states.
```
### Product Order States

State Description

PENDING_CONFIRMATIONOrder has been placed by buyer and awaits seller confirmation.

CONFIRMED Seller accepted the order; transaction should proceed.

READY_FOR_PICKUP Seller marks order ready for pickup by buyer.

OUT_FOR_DELIVERY Seller is delivering the item within the building.

COMPLETED Order fulfilled successfully.

CANCELLED Order cancelled before completion.

EXPIRED Order automatically closed because no action was taken in time.

### Service Booking States

State Description

REQUESTED Buyer requested a time slot for a service.

CONFIRMED Seller accepted the booking; slot is blocked.

IN_PROGRESS Service is currently being rendered (optional state).

COMPLETED Service was delivered successfully.

CANCELLED Booking cancelled by either party.

NO_SHOW Buyer did not appear for the confirmed booking.


## 8. Payments & Fees (High-Level)

MVP may support off-platform payments (cash, bank transfer) tracked in the system as order
attributes. A later phase can add integrated payments, commissions per order, seller wallets, and
scheduled payouts with KYC when necessary. Subscription payments can use the same payment
rails to charge recurring fees for STANDARD and PREMIUM plans.

## 9. Ratings, Reviews & Reputation

After completion of an order or booking, both buyer and seller can rate each other and leave a short
review. Ratings feed into seller reputation, listing scores, and internal metrics. Reviews can be
reported and moderated by admins if abusive or inappropriate.

## 10. Moderation & Reporting

Residents can report listings, reviews, users, or messages, providing reasons and optional
descriptions. Building Admins can remove or hide content, warn users, restrict listing creation, or
escalate cases to Platform Admins. Platform Admins can apply global bans or disable marketplace
features for problematic buildings.

## 11. Notifications

The system sends notifications for registration and verification events, listing approvals, order and
booking updates, new chat messages, and new reviews. Notifications also inform sellers about
subscription start, renewal, upcoming expiry, and failed payments (when applicable). Channels may
include in-app notifications, push notifications, and email for more critical events.

## 12. Building & Platform Admin Panels

Building Admin Panel: verify residents, moderate listings, view building KPIs, and tune local rules
such as allowed categories and verification methods. Optionally, building admins can see how
many sellers in their building are on each subscription tier.
Platform Admin Panel: manage all buildings and admins, configure global categories and settings,
view global KPIs, define subscription products (FREE, STANDARD, PREMIUM), and handle severe
moderation cases.

## 13. High-Level Data Model (Conceptual)

Core entities include User, Building, Unit, ResidentBuilding, Listing, ListingPhoto, Order,
ChatThread, Message, Review, Report, SubscriptionPlan, and SellerSubscription. The following
diagram gives a simplified textual view of relationships:

- User 1..* — 1..* Building (via ResidentBuilding)
- Building 1..* — 1..* Unit
- User 1..* — 1..* Listing (seller)
- Listing 1..* — 0..* Order
- Order 1 — 1 ChatThread — * Messages
- Order 1..* — 0..1 Review (per side)
- Any entity — 0..* Report
- SubscriptionPlan 1..* — 0..* SellerSubscription — 1 User (Seller)


## 14. Non-Functional Requirements

Security: HTTPS, hashed passwords, role-based access control, and strong validation to prevent
cross-building data leaks. Subscription-related endpoints must be protected against privilege
escalation (e.g., only the platform can create plans, only the seller can manage their own
subscription).
Performance: paginated listing and order queries, optimized search per building, caching of
frequently accessed data. Subscription tier should be cached or denormalized on user and listing to
avoid repeated joins in ranking.
Scalability: multi-building architecture capable of supporting thousands of residents per building.
Reliability: logging of critical actions, monitoring, and basic error handling.

## 15. MVP vs Future Enhancements

MVP includes multi-building support with verification, product and service listings, listing
moderation, search, orders and bookings without integrated payments, order chat, ratings and
reviews, basic notifications, admin panels, and a simple subscription model with FREE and
PREMIUM tiers (configurable). Future phases can add STANDARD and additional tiers, integrated
payments, advanced analytics, cross-building marketplace, promotions, and public seller store
pages.


## 16. Seller Subscription Plans & Highlighting

```
The platform offers subscription plans for sellers (residents who publish listings). Subscription plans
control how many listings a seller can publish and how prominently their listings appear in search
and category results. This section defines the default tiers and core business rules.
```
### 16.1 Default Subscription Tiers

Plan Fee (Example) Listing Limit Highlighting Sorting Priority Notes

FREE $0/month (configurable) 1 active listing (product or service) per seller.No special highlighting. Lowest priority (after PREMIUM and STANDARD).Good for casual or first-time sellers.

STANDARD Configurable monthly feeUnlimited active listings within the building (subject to abuse rules).No special highlighting (plain cards).Middle priority (after PREMIUM, before FREE).For frequent sellers who do not need extra visibility.

PREMIUM Higher configurable monthly feeUnlimited active listings. Listings are visually highlighted (badge, border, or background) and optionally labeled as 'Featured' or 'Premium'.Highest priority within sorting (appears before STANDARD and FREE), with internal ordering still affected by relevance, rating, and recency.Ideal for power sellers who want maximum exposure.

### 16.2 Subscription Business Rules

- Each seller has at most one active subscription per building at a time (FREE is the default when
there is no paid plan). • The FREE tier enforces a hard limit of one ACTIVE listing. When a seller
attempts to activate or create a second listing, the system must reject the action with a clear
message and an upsell prompt to STANDARD or PREMIUM. • STANDARD and PREMIUM tiers
allow unlimited listings, but the Platform Admin may define soft or hard caps to prevent abuse (e.g.,
50 listings). • Listing count limitations apply to ACTIVE status only; DRAFT, ARCHIVED, or
REJECTED listings do not count. • When a subscription downgrades (e.g., PREMIUM → FREE),
the system must decide what to do with excess listings: - Option A (recommended): keep the most
recent listing ACTIVE and automatically PAUSE all others, informing the seller. - Option B: prompt
the seller to manually choose which listing stays ACTIVE before downgrade completes.

### 16.3 Highlighting & Ranking Logic

```
The marketplace uses subscription tier as a primary factor for ranking and highlighting listings,
combined with relevance and performance metrics: • Sorting Priority: PREMIUM > STANDARD >
FREE by default. Within each tier, listings are sorted by a combination of recency, rating, and
relevance to the search query. • Highlighting Rules for PREMIUM: - PREMIUM listings may display
a 'Premium' or 'Featured' badge next to the seller name or listing title. - PREMIUM cards may use a
slightly different border, background, or icon to draw attention without overwhelming the UI. •
STANDARD listings are visually identical to FREE listings but benefit from better placement than
FREE in default ordering. • Building Admins may optionally pin specific listings (of any tier) as
'Building Featured'; these appear above subscription-based ordering.
```
### 16.4 Subscription Lifecycle

- Creation: Seller selects a plan (STANDARD or PREMIUM), agrees to pricing, and completes
payment (immediate activation upon success). • Renewal: Plans renew automatically on a
configurable cycle (monthly by default). On failed renewal, there is a grace period where benefits
remain but the system retries payment. • Grace & Downgrade: If payment ultimately fails, seller is
downgraded to FREE and listing limits and ranking rules are enforced. • Cancellation: Seller can
cancel at any time; plan remains active until the end of the current billing period, after which the
seller is downgraded to FREE. • Audit & Logs: All subscription changes (plan change, activation,
cancellation, failures) are logged with timestamps and user IDs for support and billing reconciliation.


### 16.5 Data Model Additions

New entities and fields to support subscriptions: • SubscriptionPlan: id, name
(FREE/STANDARD/PREMIUM), description, monthlyPrice, currency, maxActiveListings,
sortPriority, isHighlightEnabled, isDefaultFree. • SellerSubscription: id, userId, buildingId, planId,
status (ACTIVE, CANCELLED, EXPIRED), startDate, endDate, renewsAt, lastPaymentStatus. •
User (Seller): currentSubscriptionTier cached field for fast access. • Listing: optional
subscriptionTier snapshot (FREE/STANDARD/PREMIUM) at creation time for analytics.



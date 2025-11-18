-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SYSTEM', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('ORDER', 'BOOKING');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('ACTIVE', 'FLAGGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REGISTRATION', 'VERIFICATION', 'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_READY', 'ORDER_DELIVERED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'BOOKING_REQUESTED', 'BOOKING_CONFIRMED', 'BOOKING_STARTED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'CHAT_MESSAGE', 'REVIEW_RECEIVED', 'REVIEW_RESPONSE', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'SYSTEM_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "participantIds" TEXT[],
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "metadata" JSONB,
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "response" TEXT,
    "type" "ReviewType" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_orderId_key" ON "chat_threads"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_bookingId_key" ON "chat_threads"("bookingId");

-- CreateIndex
CREATE INDEX "chat_threads_orderId_idx" ON "chat_threads"("orderId");

-- CreateIndex
CREATE INDEX "chat_threads_bookingId_idx" ON "chat_threads"("bookingId");

-- CreateIndex
CREATE INDEX "chat_threads_lastMessageAt_idx" ON "chat_threads"("lastMessageAt");

-- CreateIndex
CREATE INDEX "messages_threadId_idx" ON "messages"("threadId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_sentAt_idx" ON "messages"("sentAt");

-- CreateIndex
CREATE INDEX "reviews_orderId_idx" ON "reviews"("orderId");

-- CreateIndex
CREATE INDEX "reviews_bookingId_idx" ON "reviews"("bookingId");

-- CreateIndex
CREATE INDEX "reviews_reviewerId_idx" ON "reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "reviews_revieweeId_idx" ON "reviews"("revieweeId");

-- CreateIndex
CREATE INDEX "reviews_listingId_idx" ON "reviews"("listingId");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_createdAt_idx" ON "reviews"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderId_reviewerId_key" ON "reviews"("orderId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_reviewerId_key" ON "reviews"("bookingId", "reviewerId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_readAt_idx" ON "notifications"("readAt");

-- CreateIndex
CREATE INDEX "notifications_sentAt_idx" ON "notifications"("sentAt");

-- CreateIndex
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_channel_type_key" ON "notification_preferences"("userId", "channel", "type");

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

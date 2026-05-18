-- Deal&Co Pet — paid pet-services matching module (separate universe, 10% commission)

-- CreateTable
CREATE TABLE "PetProService" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "stripeAccountId" TEXT,
    "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "kycCompletedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "avgRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetProService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetServiceOffering" (
    "id" TEXT NOT NULL,
    "proServiceId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'DAY',
    "petTypes" TEXT NOT NULL DEFAULT '["DOG"]',
    "maxPets" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetServiceOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetBooking" (
    "id" TEXT NOT NULL,
    "proServiceId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "petCount" INTEGER NOT NULL DEFAULT 1,
    "petInfo" TEXT,
    "totalCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "proPayoutCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "PetBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "stripeTransferId" TEXT,
    "stripeRefundId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" TEXT NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "capturedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "proServiceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetProService_userId_key" ON "PetProService"("userId");
CREATE UNIQUE INDEX "PetProService_slug_key" ON "PetProService"("slug");
CREATE UNIQUE INDEX "PetProService_stripeAccountId_key" ON "PetProService"("stripeAccountId");
CREATE INDEX "PetProService_city_idx" ON "PetProService"("city");
CREATE INDEX "PetProService_isPublished_kycCompletedAt_idx" ON "PetProService"("isPublished", "kycCompletedAt");

CREATE INDEX "PetServiceOffering_proServiceId_isActive_idx" ON "PetServiceOffering"("proServiceId", "isActive");
CREATE INDEX "PetServiceOffering_serviceType_idx" ON "PetServiceOffering"("serviceType");

CREATE INDEX "PetBooking_clientId_idx" ON "PetBooking"("clientId");
CREATE INDEX "PetBooking_proServiceId_status_idx" ON "PetBooking"("proServiceId", "status");
CREATE INDEX "PetBooking_status_endDate_idx" ON "PetBooking"("status", "endDate");

CREATE UNIQUE INDEX "PetPayment_bookingId_key" ON "PetPayment"("bookingId");
CREATE UNIQUE INDEX "PetPayment_stripePaymentIntentId_key" ON "PetPayment"("stripePaymentIntentId");
CREATE INDEX "PetPayment_status_idx" ON "PetPayment"("status");

CREATE UNIQUE INDEX "PetReview_bookingId_key" ON "PetReview"("bookingId");
CREATE INDEX "PetReview_proServiceId_idx" ON "PetReview"("proServiceId");

-- AddForeignKey
ALTER TABLE "PetProService" ADD CONSTRAINT "PetProService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetServiceOffering" ADD CONSTRAINT "PetServiceOffering_proServiceId_fkey" FOREIGN KEY ("proServiceId") REFERENCES "PetProService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetBooking" ADD CONSTRAINT "PetBooking_proServiceId_fkey" FOREIGN KEY ("proServiceId") REFERENCES "PetProService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PetBooking" ADD CONSTRAINT "PetBooking_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "PetServiceOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PetBooking" ADD CONSTRAINT "PetBooking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PetPayment" ADD CONSTRAINT "PetPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetReview" ADD CONSTRAINT "PetReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetReview" ADD CONSTRAINT "PetReview_proServiceId_fkey" FOREIGN KEY ("proServiceId") REFERENCES "PetProService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PetReview" ADD CONSTRAINT "PetReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

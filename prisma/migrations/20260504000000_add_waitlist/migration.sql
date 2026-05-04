-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "citySlug" TEXT,
    "categoryId" TEXT,
    "subcategorySlug" TEXT,
    "source" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_email_categoryId_citySlug_subcategorySlug_key" ON "Waitlist"("email", "categoryId", "citySlug", "subcategorySlug");

-- CreateIndex
CREATE INDEX "Waitlist_email_idx" ON "Waitlist"("email");

-- CreateIndex
CREATE INDEX "Waitlist_categoryId_idx" ON "Waitlist"("categoryId");

-- CreateIndex
CREATE INDEX "Waitlist_citySlug_idx" ON "Waitlist"("citySlug");

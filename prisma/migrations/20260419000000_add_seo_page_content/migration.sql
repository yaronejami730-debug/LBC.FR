-- CreateTable
CREATE TABLE "SeoPageContent" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategorySlug" TEXT,
    "citySlug" TEXT,
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "localTips" TEXT,
    "faq" TEXT NOT NULL DEFAULT '[]',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "model" TEXT NOT NULL DEFAULT 'claude',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoPageContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoPageContent_pageKey_key" ON "SeoPageContent"("pageKey");

-- CreateIndex
CREATE INDEX "SeoPageContent_categoryId_idx" ON "SeoPageContent"("categoryId");

-- CreateIndex
CREATE INDEX "SeoPageContent_citySlug_idx" ON "SeoPageContent"("citySlug");

-- CreateIndex
CREATE INDEX "SeoPageContent_categoryId_citySlug_idx" ON "SeoPageContent"("categoryId", "citySlug");

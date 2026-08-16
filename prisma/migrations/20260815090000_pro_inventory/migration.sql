-- Inventaire professionnel : produits, variantes, mouvements de stock.
--
-- Migration additive. Une colonne nullable sur "Listing", trois tables neuves,
-- aucune donnée existante lue ni déplacée. Les annonces déjà publiées gardent
-- `productId` nul et continuent de fonctionner exactement comme avant : le lien
-- à un produit est une possibilité, jamais une obligation.
--
-- `IF NOT EXISTS` partout, donc rejouable sans effet.

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "productId" TEXT;
CREATE INDEX IF NOT EXISTS "Listing_productId_idx" ON "Listing"("productId");

CREATE TABLE IF NOT EXISTS "ProProduct" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "section" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "comparePrice" DOUBLE PRECISION,
    "quantity" INTEGER,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "lowStockAt" INTEGER,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProProduct_pkey" PRIMARY KEY ("id")
);

-- Référence unique par établissement, pas globalement : deux boutiques peuvent
-- très bien employer « TS-BLC-M » chacune de son côté.
CREATE UNIQUE INDEX IF NOT EXISTS "ProProduct_profileId_sku_key" ON "ProProduct"("profileId", "sku");
CREATE INDEX IF NOT EXISTS "ProProduct_profileId_status_position_idx"
  ON "ProProduct"("profileId", "status", "position");

CREATE TABLE IF NOT EXISTS "ProProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "priceDelta" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProProductVariant_productId_position_idx"
  ON "ProProductVariant"("productId", "position");

CREATE TABLE IF NOT EXISTS "ProStockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "delta" INTEGER NOT NULL,
    "resulting" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProStockMovement_productId_createdAt_idx"
  ON "ProStockMovement"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProStockMovement_variantId_createdAt_idx"
  ON "ProStockMovement"("variantId", "createdAt");

-- Clés étrangères. `DO $$ … $$` parce que PostgreSQL n'accepte pas
-- `ADD CONSTRAINT IF NOT EXISTS` : sans ce garde, rejouer la migration échoue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProProduct_profileId_fkey') THEN
    ALTER TABLE "ProProduct" ADD CONSTRAINT "ProProduct_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProProductVariant_productId_fkey') THEN
    ALTER TABLE "ProProductVariant" ADD CONSTRAINT "ProProductVariant_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "ProProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProStockMovement_productId_fkey') THEN
    ALTER TABLE "ProStockMovement" ADD CONSTRAINT "ProStockMovement_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "ProProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProStockMovement_variantId_fkey') THEN
    ALTER TABLE "ProStockMovement" ADD CONSTRAINT "ProStockMovement_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- SetNull : archiver un produit ne doit pas effacer l'annonce qui portait son
  -- historique de vues et de conversations.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Listing_productId_fkey') THEN
    ALTER TABLE "Listing" ADD CONSTRAINT "Listing_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "ProProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

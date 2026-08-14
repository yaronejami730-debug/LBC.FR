-- Corrections de catégorie faites par les utilisateurs.
--
-- Sert à mesurer les erreurs récurrentes du moteur, jamais à modifier la
-- taxonomie automatiquement : une correction isolée peut être une erreur de
-- l'utilisateur, pas du moteur. On collecte, on analyse, puis on décide.
CREATE TABLE "CategoryFeedback" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "suggestedCategoryId" TEXT,
    "suggestedSubcategory" TEXT,
    "confidence" DOUBLE PRECISION,
    "chosenCategoryId" TEXT NOT NULL,
    "chosenSubcategory" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryFeedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CategoryFeedback_createdAt_idx" ON "CategoryFeedback"("createdAt");
CREATE INDEX "CategoryFeedback_suggestedCategoryId_chosenCategoryId_idx"
    ON "CategoryFeedback"("suggestedCategoryId", "chosenCategoryId");

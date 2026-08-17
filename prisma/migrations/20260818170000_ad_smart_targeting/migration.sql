-- Ciblage intelligent : l'option côté annonceur, l'interrupteur côté régie.
--
-- Deux niveaux, et ils ne disent pas la même chose. L'annonceur déclare qu'il
-- accepte d'être diffusé selon l'intention du visiteur plutôt que selon ses
-- seules cases de ciblage. La régie, elle, décide si le mécanisme est actif du
-- tout : avec trois annonceurs, classer par pertinence revient à choisir entre
-- trois publicités dont deux sont hors sujet — le classement n'a de sens qu'à
-- partir d'un inventaire fourni.
ALTER TABLE "AdCampaign" ADD COLUMN "smartTargeting" BOOLEAN NOT NULL DEFAULT false;

-- Réglages de la régie. Une table clé/valeur volontairement générique : les
-- réglages d'une régie changent plus vite que son schéma, et chacun d'eux ne
-- mérite pas une migration.
CREATE TABLE "AdSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "AdSetting_pkey" PRIMARY KEY ("key")
);

-- Désactivé au départ, comme demandé : la diffusion reste manuelle et
-- classique tant que la régie n'a pas assez d'annonceurs pour que suggérer ait
-- un sens.
INSERT INTO "AdSetting" ("key", "value", "updatedAt") VALUES
    ('smart_suggestions', 'false', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

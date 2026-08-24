-- Extrait cité des articles dont le flux publie le corps.
--
-- Citation bornée, présentée comme telle et attribuée : le flux livre le texte,
-- il ne le cède pas.
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "excerpt" TEXT;

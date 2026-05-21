-- Unicité du numéro de téléphone par compte.
-- Suppression des doublons en pré-traitement : conserve le compte le plus ancien,
-- met les autres à NULL pour qu'ils puissent ressaisir leur numéro proprement.
UPDATE "User" SET "phoneNumber" = NULL
WHERE "id" IN (
  SELECT u."id"
  FROM "User" u
  JOIN (
    SELECT "phoneNumber", MIN("createdAt") AS firstCreated
    FROM "User"
    WHERE "phoneNumber" IS NOT NULL
    GROUP BY "phoneNumber"
    HAVING COUNT(*) > 1
  ) dup ON dup."phoneNumber" = u."phoneNumber"
  WHERE u."createdAt" > dup.firstCreated
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneNumber_key" ON "User"("phoneNumber");

-- Adresse à laquelle le salon envoie les accès au planning.
--
-- Facultative : un membre peut très bien recevoir son identifiant de vive voix,
-- sur un papier. Elle sert à envoyer et à renvoyer les accès sans les
-- redemander à chaque fois.
ALTER TABLE "ProMember" ADD COLUMN "email" TEXT;

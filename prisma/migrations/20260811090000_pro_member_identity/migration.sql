-- Prénom et nom d'un membre d'équipe.
--
-- `displayName` reste ce que voit le client sur la fiche : « Corinne », pas
-- « Corinne Deschamps ». Un carnet de rendez-vous a besoin de l'état civil —
-- deux Nathalie dans le même salon se distinguent par leur nom — mais le
-- publier sur une page indexée exposerait le salarié bien au-delà de son
-- travail. D'où deux champs internes et un libellé public dérivé.
ALTER TABLE "ProMember" ADD COLUMN "firstName" TEXT;
ALTER TABLE "ProMember" ADD COLUMN "lastName" TEXT;

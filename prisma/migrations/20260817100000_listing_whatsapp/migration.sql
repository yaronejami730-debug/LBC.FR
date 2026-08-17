-- Le numéro est-il joignable sur WhatsApp ?
--
-- Le bouton WhatsApp s'affichait dès qu'un numéro existait. Sur une ligne
-- fixe ou un mobile sans compte, l'acheteur tombait sur « ce numéro n'est pas
-- sur WhatsApp » — et c'est le vendeur qui passait pour injoignable. On le
-- demande donc, plutôt que de le supposer.
--
-- Défaut à `false` : sans réponse explicite, on ne promet rien.
ALTER TABLE "Listing" ADD COLUMN "phoneOnWhatsapp" BOOLEAN NOT NULL DEFAULT false;

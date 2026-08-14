-- Rattachement des agrégats à leur campagne : les écrans filtrent par
-- annonceur, ce qui passe par la campagne. La cascade évite des agrégats
-- orphelins quand une campagne est supprimée.
ALTER TABLE "AdStatDaily" ADD CONSTRAINT "AdStatDaily_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

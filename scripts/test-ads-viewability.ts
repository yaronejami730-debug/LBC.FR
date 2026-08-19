/**
 * Vérifications de la mesure de visibilité et de l'anti-fraude.
 *
 * Ces deux modules décident si un événement est facturable. Une erreur ici ne
 * casse rien de visible : elle facture simplement des choses qui n'auraient pas
 * dû l'être, et personne ne s'en aperçoit avant qu'un annonceur compare ses
 * chiffres aux siens.
 *
 *     npx tsx scripts/test-ads-viewability.ts
 */
import {
  assessViewability,
  EMAIL_VIEWABILITY,
  MIN_VIEWPORT_RATIO,
  MIN_VISIBLE_MS,
} from "../lib/ads/viewability";
import {
  assessSignals,
  DOUBLE_CLICK_MS,
  isBotUserAgent,
  MAX_CLICKS_PER_AD_HOUR,
  MAX_VIEWABLES_PER_AD_HOUR,
  type SignalCounts,
} from "../lib/ads/fraud";
import { check, equal, report, section } from "./test-helpers";

const HUMAIN =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

section("Ce qui compte comme une impression visible");
{
  equal(
    "publicité chargée mais jamais à l'écran : non facturable",
    assessViewability({ viewportPct: 0, visibleMs: 0 }).viewable,
    false,
  );
  equal(
    "visible à 20 % : non facturable",
    assessViewability({ viewportPct: 0.2, visibleMs: 5000 }).viewable,
    false,
  );
  equal(
    "visible à 60 % pendant 300 ms : non facturable",
    assessViewability({ viewportPct: 0.6, visibleMs: 300 }).viewable,
    false,
  );
  equal(
    "visible à 60 % pendant une seconde : impression visible",
    assessViewability({ viewportPct: 0.6, visibleMs: 1000 }).viewable,
    true,
  );
  equal(
    "exactement au seuil : impression visible",
    assessViewability({ viewportPct: MIN_VIEWPORT_RATIO, visibleMs: MIN_VISIBLE_MS }).viewable,
    true,
  );
  equal(
    "juste sous le seuil de surface : rien",
    assessViewability({ viewportPct: MIN_VIEWPORT_RATIO - 0.01, visibleMs: 10_000 }).viewable,
    false,
  );
}

section("Mesures impossibles");
{
  equal(
    "plus de 100 % du bloc : mesure fabriquée",
    assessViewability({ viewportPct: 3, visibleMs: 2000 }).viewable,
    false,
  );
  equal(
    "durée négative : mesure fabriquée",
    assessViewability({ viewportPct: 1, visibleMs: -50 }).viewable,
    false,
  );
  equal(
    "valeur illisible : rien",
    assessViewability({ viewportPct: Number.NaN, visibleMs: 3000 }).viewable,
    false,
  );

  const long = assessViewability({ viewportPct: 1, visibleMs: 6 * 3600_000 });
  equal("un onglet oublié reste une impression visible", long.viewable, true);
  check("mais sa durée est plafonnée", long.visibleMs <= 30 * 60_000);
}

section("E-mail");
{
  equal(
    "l'ouverture d'un e-mail vaut impression visible",
    assessViewability(EMAIL_VIEWABILITY).viewable,
    true,
  );
}

// ── Anti-fraude ─────────────────────────────────────────────────────────────

const base: SignalCounts = {
  msSinceLastClickSameAd: null,
  clicksSessionLastHour: 0,
  clicksSameAdLastHour: 0,
  viewablesSameAdLastHour: 0,
  hasRenderOnPageView: true,
};

section("Agents automatisés");
{
  equal("un robot déclaré est reconnu", isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  equal("un outil en ligne de commande aussi", isBotUserAgent("curl/8.4.0"), true);
  equal("aucun agent : traité comme un robot", isBotUserAgent(null), true);
  equal("un navigateur ordinaire passe", isBotUserAgent(HUMAIN), false);

  equal(
    "un clic de robot n'est jamais facturé",
    assessSignals("CLICK", "python-requests/2.31", base).status,
    "INVALID",
  );
  equal(
    "sauf en e-mail, où le proxy d'images est un robot légitime",
    assessSignals("VIEWABLE_IMPRESSION", "GoogleImageProxy", base, { skipUserAgentCheck: true }).status,
    "VALID",
  );
}

section("Clics");
{
  equal("un clic ordinaire est valide", assessSignals("CLICK", HUMAIN, base).status, "VALID");

  equal(
    "un clic sans affichage sur la page est impossible",
    assessSignals("CLICK", HUMAIN, { ...base, hasRenderOnPageView: false }).status,
    "INVALID",
  );

  equal(
    "un double clic ne compte qu'une fois",
    assessSignals("CLICK", HUMAIN, { ...base, msSinceLastClickSameAd: DOUBLE_CLICK_MS - 200 }).status,
    "INVALID",
  );
  equal(
    "un second clic bien plus tard reste valide",
    assessSignals("CLICK", HUMAIN, { ...base, msSinceLastClickSameAd: 120_000 }).status,
    "VALID",
  );

  equal(
    "des clics répétés sur le même créatif partent en vérification",
    assessSignals("CLICK", HUMAIN, { ...base, clicksSameAdLastHour: MAX_CLICKS_PER_AD_HOUR }).status,
    "FRAUD_REVIEW",
  );
  equal(
    "une cadence anormale sur la session aussi",
    assessSignals("CLICK", HUMAIN, { ...base, clicksSessionLastHour: 20 }).status,
    "FRAUD_REVIEW",
  );
}

section("Rafraîchissement en boucle");
{
  equal(
    "vingt affichages du même créatif en une heure : vérification",
    assessSignals("VIEWABLE_IMPRESSION", HUMAIN, {
      ...base,
      viewablesSameAdLastHour: MAX_VIEWABLES_PER_AD_HOUR,
    }).status,
    "FRAUD_REVIEW",
  );
  equal(
    "trois affichages : navigation normale",
    assessSignals("VIEWABLE_IMPRESSION", HUMAIN, { ...base, viewablesSameAdLastHour: 3 }).status,
    "VALID",
  );
}

report("Visibilité et anti-fraude");

/**
 * Plan de l'administration — les chapitres et ce qu'ils contiennent.
 *
 * Une seule définition, ici. Elle sert trois choses à la fois : la barre
 * latérale, les droits d'une équipe interne, et l'écran qui attribue ces
 * droits. Le jour où l'on ajoute un écran, une ligne suffit, et les trois le
 * voient en même temps.
 *
 * La liste plate d'une vingtaine d'entrées ne se lisait plus : « Annonceurs »,
 * « Comptes annonceurs », « Publicités », « Campagnes pub », « Diffusion pub »
 * et « Bannières » vivaient côte à côte sans qu'on sache lequel faisait quoi.
 * Le regroupement en chapitres répond à la question qu'on se pose vraiment en
 * arrivant : *de quoi je m'occupe maintenant ?*
 */

export type AdminEntry = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  /** Une phrase, affichée dans l'écran des équipes. */
  hint?: string;
};

export type AdminSection = {
  /** Clé stable stockée dans les droits d'équipe. Ne jamais renommer. */
  key: string;
  label: string;
  icon: string;
  entries: AdminEntry[];
};

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: "vue",
    label: "Vue d'ensemble",
    icon: "grid_view",
    entries: [{ href: "/admin", label: "Tableau de bord", icon: "grid_view", exact: true }],
  },

  {
    key: "moderation",
    label: "Modération",
    icon: "gavel",
    entries: [
      { href: "/admin/listings", label: "Annonces", icon: "list_alt", hint: "Valider, corriger, retirer" },
      { href: "/admin/securite", label: "Centre de sécurité", icon: "shield", hint: "Signalements, fraude, bannissements" },
      { href: "/admin/users", label: "Utilisateurs", icon: "group", hint: "Comptes, sanctions" },
      { href: "/admin/categories", label: "Catégories", icon: "tune", hint: "Arborescence du catalogue" },
      { href: "/admin/categorisation", label: "Catégorisation", icon: "auto_awesome", hint: "Moteur de classement" },
    ],
  },

  {
    key: "support",
    label: "Support",
    icon: "support_agent",
    entries: [
      { href: "/admin/support", label: "Discussions", icon: "forum", hint: "Fils ouverts avec les utilisateurs" },
      { href: "/admin/satisfaction", label: "Satisfaction", icon: "reviews", hint: "Enquêtes et retours" },
      { href: "/admin/notifications", label: "Notifications", icon: "notifications", hint: "Envois push et e-mail" },
    ],
  },

  {
    key: "professionnels",
    label: "Comptes professionnels",
    icon: "verified_user",
    entries: [
      {
        href: "/admin/professionnels",
        label: "Vérifications",
        icon: "badge",
        hint: "Pièces d'identité, Kbis, décisions",
      },
    ],
  },

  {
    key: "publicite",
    label: "Publicité",
    icon: "campaign",
    entries: [
      { href: "/admin/publicite/annonceurs", label: "Annonceurs", icon: "ads_click", hint: "Comptes qui diffusent" },
      { href: "/admin/publicite/campagnes", label: "Campagnes", icon: "rate_review", hint: "Validation des créatifs" },
      { href: "/admin/publicite/diffusion", label: "Diffusion", icon: "equalizer", hint: "Emplacements, tarifs, ciblage" },
      { href: "/admin/annonceurs", label: "Prospects", icon: "handshake", hint: "Pipeline commercial, avant le compte" },
      // Bannières maison : servies quand aucune campagne n'est éligible. Ce
      // n'est pas de la régie, c'est du repli — d'où la place en fin de
      // chapitre plutôt qu'un écran « Publicités » distinct.
      { href: "/admin/ads", label: "Bannières maison", icon: "wallpaper", hint: "Repli quand aucune campagne ne sort" },
      { href: "/admin/banniere", label: "Bandeau d'accueil", icon: "photo_frame", hint: "Le grand visuel de la page d'accueil" },
    ],
  },

  {
    key: "acquisition",
    label: "Acquisition",
    icon: "travel_explore",
    entries: [
      { href: "/admin/seo", label: "Indexation SEO", icon: "travel_explore", hint: "Verdicts et budget de crawl" },
      { href: "/admin/recommandations", label: "Recommandations", icon: "near_me", hint: "Suggestions locales" },
      { href: "/admin/behavioral", label: "Moteur comportemental", icon: "psychology", hint: "Relances et intentions" },
      { href: "/admin/crm", label: "CRM", icon: "contacts", hint: "Relation commerciale" },
    ],
  },

  {
    key: "sondage",
    label: "Sondage",
    icon: "poll",
    entries: [
      {
        href: "/admin/sondage",
        label: "Comment nous ont-ils connus",
        icon: "poll",
        hint: "Acquisition déclarée par les utilisateurs",
      },
    ],
  },

  {
    key: "equipes",
    label: "Équipes",
    icon: "admin_panel_settings",
    entries: [
      { href: "/admin/equipes", label: "Équipes internes", icon: "diversity_3", hint: "Qui accède à quoi" },
    ],
  },
];

/** Toutes les clés de section, dans l'ordre d'affichage. */
export const SECTION_KEYS = ADMIN_SECTIONS.map((s) => s.key);

/**
 * Sections visibles pour un jeu de droits.
 *
 * `["*"]` ouvre tout — c'est la direction. Un tableau vide ne montre rien :
 * mieux vaut un écran vide qu'un accès accordé par défaut.
 */
export function visibleSections(granted: string[]): AdminSection[] {
  if (granted.includes("*")) return ADMIN_SECTIONS;
  // La vue d'ensemble suit les autres droits : elle n'expose rien par
  // elle-même, et une administration qui s'ouvre sur une page vide déroute.
  const set = new Set(granted);
  return ADMIN_SECTIONS.filter((s) => set.has(s.key) || (s.key === "vue" && granted.length > 0));
}

/** La section à laquelle appartient une adresse, ou `null`. */
export function sectionForPath(pathname: string): AdminSection | null {
  let best: { section: AdminSection; length: number } | null = null;
  for (const section of ADMIN_SECTIONS) {
    for (const entry of section.entries) {
      const matches = entry.exact ? pathname === entry.href : pathname.startsWith(entry.href);
      // Le plus long chemin gagne : `/admin/publicite/annonceurs` ne doit pas
      // être capté par `/admin`.
      if (matches && (!best || entry.href.length > best.length)) {
        best = { section, length: entry.href.length };
      }
    }
  }
  return best?.section ?? null;
}

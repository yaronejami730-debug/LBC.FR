"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import UserDropdown from "./UserDropdown";

/**
 * Le seul morceau de la barre de navigation qui dépende de qui regarde.
 *
 * ── Pourquoi il est client ────────────────────────────────────────────────
 *
 * La `Navbar` appelait `auth()` côté serveur, donc lisait un cookie, donc
 * rendait dynamique **chaque page qui l'affiche**. Les pages SEO déclaraient
 * pourtant leur génération statique : elles la perdaient toutes, sans erreur ni
 * avertissement. `app/layout.tsx` documentait déjà le piège pour `cookies()` —
 * la barre le déclenchait un étage plus bas.
 *
 * Sortir la session du rendu serveur rend les pages de nouveau pré-rendables :
 * elles repartent du CDN au lieu de l'origine, et le budget d'exploration cesse
 * d'être dépensé en attente de base de données.
 *
 * ── Ce que ça change à l'écran ────────────────────────────────────────────
 *
 * Rien de visible. Le bouton déclencheur est le même pour un visiteur anonyme
 * et pour un compte connecté ; seul le contenu du menu diffère, et il est
 * rempli dès que la session est connue. Pas de bascule de mise en page, donc
 * pas de saut visuel.
 */
export default function NavbarUser() {
  const { data: session } = useSession();
  const user = session?.user;

  const [extra, setExtra] = useState({ isPro: false, membershipCount: 0 });

  useEffect(() => {
    if (!user) {
      setExtra({ isPro: false, membershipCount: 0 });
      return;
    }

    let cancelled = false;
    fetch("/api/me/nav")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // Deux entrées de menu en dépendent — l'accès API et « Mon agenda ».
        // Leur absence passagère ne casse rien : elles apparaissent une fois la
        // réponse arrivée.
        if (!cancelled && data) {
          setExtra({
            isPro: Boolean(data.isPro),
            membershipCount: Number(data.membershipCount) || 0,
          });
        }
      })
      .catch(() => {
        /* le menu reste utilisable sans ces deux entrées */
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <UserDropdown
      user={user ? { name: user.name, email: user.email } : null}
      isPro={extra.isPro}
      membershipCount={extra.membershipCount}
    />
  );
}

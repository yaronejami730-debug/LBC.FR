# Deal&Co — App mobile (Expo / React Native)

App iOS + Android pour Deal&Co. Consomme l'API Next.js du repo parent (`/app/api/*`).

## Sprint 1 livré

- Setup projet Expo SDK 54 + expo-router + NativeWind (Tailwind)
- Auth: login, register, forgot-password (via `/api/mobile/auth/*` — JWT bearer)
- Home: hero, catégories, 6 rangées de listings (`/api/feed/home`)
- Annonce detail (`/annonce/[id]` via `/api/listings/[id]`)
- Bottom tabs: Accueil · Recherche · Publier · Messages · Profil

## Endpoints backend ajoutés (côté Next.js)

- `POST /api/mobile/auth/login` → `{ token, user }`
- `POST /api/mobile/auth/register` → `{ token, user }`
- `GET /api/mobile/auth/me` (Authorization: Bearer) → `{ user }`
- `GET /api/feed/home` → 6 rangées agrégées

Le bearer JWT est signé avec `AUTH_SECRET` (HS256). Vérifié via `lib/mobile-auth.ts`.

## Installation

```bash
cd mobile
npm install
```

Si le simulateur iOS n'est pas configuré :

```bash
xcode-select --install
sudo xcodebuild -license
```

## Lancer en dev

```bash
npm run ios       # simulateur iOS
npm run android   # émulateur Android
npm start         # QR code Expo Go
```

L'app appelle par défaut `https://www.dealandcompany.fr`. Pour pointer sur localhost en dev, éditer `app.json` → `expo.extra.apiBaseUrl` (et utiliser l'IP LAN, pas `localhost`, sur device physique).

## Build pour TestFlight / App Store

Nécessite un compte Apple Developer (99 $/an) et EAS :

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
eas submit --platform ios
```

## Push notifications (à implémenter)

- Plugin `expo-notifications` déjà installé.
- À faire : enregistrer le token APNs au login (`POST /api/mobile/devices` côté backend), table `DeviceToken` Prisma, déclencher push sur nouveau message via `expo-server-sdk`.

## Reste à porter (sprints suivants)

- Search complet (filtres, tri, OpenSearch)
- Formulaire publication (`/post` web → `/(tabs)/post` mobile, avec upload images Vercel Blob)
- Messagerie temps réel (SSE → polling/websocket adaptés mobile)
- Favoris, recherches sauvegardées
- Profil détaillé + édition + tab pro
- Pet (booking)
- Email verification flow (saisie code 6 chiffres)
- Push notif end-to-end
- Blog, comparatifs, contenus statiques (CGU, mentions)

## Structure

```
mobile/
├── app/
│   ├── _layout.tsx           # AuthProvider + Stack root
│   ├── (tabs)/               # Bottom tabs (accueil, recherche, post, messages, profil)
│   ├── (auth)/               # Modale auth (login, register, forgot)
│   └── annonce/[id].tsx
├── components/home/          # ListingCard, ListingRow, HeroBanner, CategoryGrid
├── lib/
│   ├── api.ts                # fetch wrapper bearer
│   ├── auth.tsx              # AuthProvider + useAuth
│   ├── tokenStore.ts         # expo-secure-store
│   ├── config.ts             # API_BASE_URL
│   └── format.ts             # prix, dates, images
├── app.json                  # Expo config (bundle iOS, plugins, scheme)
├── tailwind.config.js        # Mirror partiel theme web
└── package.json              # SDK 54, RN 0.81, React 19
```

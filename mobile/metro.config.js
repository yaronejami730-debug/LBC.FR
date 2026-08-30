const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

/**
 * Forcer une copie unique de React (et de son moteur de rendu natif).
 *
 * ── Le problème ───────────────────────────────────────────────────────────
 *
 * Cette application vit dans un sous-dossier d'un projet Next.js qui a son
 * propre `node_modules`. Metro résout les modules en remontant l'arborescence,
 * comme Node : il peut donc charger le React du site web.
 *
 * `npx expo-doctor` le mesure :
 *
 *     Found duplicates for react:
 *       ├─ react@19.1.0 (at: node_modules/react)      ← attendue par RN 0.81.5
 *       └─ react@19.2.5 (at: ../node_modules/react)   ← celle du site Next.js
 *
 * Deux React dans un même bundle et l'état interne cesse d'être partagé : le
 * module qui appelle `useState` ne parle plus à celui qui a rendu le
 * composant. Cela donne « Invalid hook call », un dispatcher `null`, ou un
 * écran blanc — jamais une erreur qui nomme la cause.
 *
 * ── Pourquoi un alias, et non `disableHierarchicalLookup` ─────────────────
 *
 * La première version de ce fichier coupait la remontée d'un bloc
 * (`disableHierarchicalLookup = true`). C'était trop brutal, et la
 * compilation échouait aussitôt :
 *
 *     Unable to resolve module semver/functions/satisfies from
 *     node_modules/react-native-reanimated/scripts/validate-worklets-version.js
 *
 * Reanimated exige `semver@^7`, or `mobile/node_modules/semver` est en 6.3.1
 * (installé pour `babel-plugin-polyfill-corejs2`). npm avait correctement
 * placé la version 7 en imbriqué, sous
 * `node_modules/react-native-reanimated/node_modules/semver` — mais couper la
 * remontée empêche Metro de lire ces `node_modules` imbriqués, qui sont
 * précisément le mécanisme par lequel npm fait cohabiter deux versions d'un
 * même paquet. On casse alors bien plus que ce qu'on répare.
 *
 * L'alias ci-dessous ne vise que les paquets dont l'unicité est une condition
 * de fonctionnement, et laisse la résolution normale opérer pour tout le
 * reste.
 *
 * ⚠️ N'ajouter ici que des paquets qui portent un état global partagé. Un
 * alias sur une bibliothèque ordinaire n'apporte rien et masquerait un vrai
 * conflit de versions.
 */
const SINGLETONS = {
  react: path.resolve(__dirname, "node_modules/react"),
  "react-native": path.resolve(__dirname, "node_modules/react-native"),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forced = SINGLETONS[moduleName];
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  return resolve(context, forced ?? moduleName, platform);
};

/** Ne surveiller que ce dossier — inutile de suivre les sources du site web. */
config.watchFolders = [__dirname];

module.exports = withNativeWind(config, { input: "./global.css" });

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    /**
     * Le plugin des worklets est **obligatoire** dès qu'on utilise Reanimated,
     * et il manquait ici.
     *
     * Reanimated exécute ses animations sur un second thread JavaScript. Les
     * fonctions concernées doivent être compilées en « worklets » — c'est ce
     * plugin qui fait cette transformation. Sans lui, le code se compile
     * normalement mais échoue à l'exécution, au moment précis où l'animation
     * démarre : `components/ZoomableImage.tsx` (le zoom sur les photos
     * d'annonce) est le seul appelant aujourd'hui, donc le plantage se produit
     * à l'ouverture d'une photo et non au lancement — ce qui rend la cause
     * difficile à rattacher à l'effet.
     *
     * ⚠️ Le nom du paquet a changé avec Reanimated 4 : c'était
     * `react-native-reanimated/plugin`, c'est désormais
     * `react-native-worklets/plugin` (paquet `react-native-worklets`, déjà en
     * dépendance). L'ancien chemin existe encore dans `node_modules` et ne
     * lève pas d'erreur à l'installation — d'où la facilité avec laquelle une
     * mise à niveau vers la version 4 laisse ce plugin derrière elle.
     *
     * Il doit rester **le dernier de la liste** : il s'attend à voir le code
     * déjà transformé par les autres.
     */
    plugins: ["react-native-worklets/plugin"],
  };
};

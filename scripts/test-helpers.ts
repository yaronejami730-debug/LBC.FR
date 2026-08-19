/**
 * Outillage de test minimal.
 *
 * Le projet lance ses vérifications par `tsx scripts/test-*.ts` : pas de
 * lanceur, pas de configuration, une commande qui sort en erreur quand quelque
 * chose casse. Ajouter un cadre de test complet pour trois fichiers coûterait
 * plus cher que ce qu'il rapporte — et personne n'installe une dépendance de
 * plus pour écrire `assert`.
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

export function equal(label: string, actual: unknown, expected: unknown): void {
  const ok = Object.is(actual, expected);
  check(label, ok, ok ? undefined : `attendu ${String(expected)}, obtenu ${String(actual)}`);
}

/** Égalité à un centime près, pour tout ce qui sort d'un arrondi. */
export function approx(label: string, actual: number, expected: number, tolerance = 1): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  check(label, ok, ok ? undefined : `attendu ~${expected}, obtenu ${actual}`);
}

export function section(title: string): void {
  console.log(`\n${title}`);
}

/** Sort en erreur si quoi que ce soit a échoué : c'est ce que lit la CI. */
export function report(suite: string): void {
  console.log(`\n${suite} — ${passed} vérifications passées, ${failed} en échec.`);
  if (failed > 0) {
    console.log(failures.map((f) => `  · ${f}`).join("\n"));
    process.exit(1);
  }
}

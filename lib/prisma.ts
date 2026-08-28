import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Client Prisma partagé, et surtout : pool Postgres qui échoue vite.
 *
 * ── Ce que faisait la version précédente ──────────────────────────────────
 *
 *     const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *
 * Un `Pool` construit ainsi prend les valeurs par défaut de `pg` :
 *
 *     max                     10
 *     connectionTimeoutMillis undefined  →  attente **illimitée**
 *     idleTimeoutMillis       10 000
 *     statement_timeout       (aucun)
 *
 * Les deux lignes du milieu se combinent en une panne franche. Quand les dix
 * connexions sont prises, la onzième requête ne reçoit pas d'erreur : elle
 * attend. Sans borne. La page qui l'a émise reste ouverte, garde son créneau
 * d'exécution, et le créneau suivant attend derrière elle.
 *
 * Mesure du 28/08/2026, sondage des 362 URL du crawl d'audit, huit en
 * parallèle — le rythme d'un crawler ordinaire :
 *
 *     164 / 362 URL         abandonnées à 30 s
 *     p50 2 705 ms          p90 30 001 ms
 *     x-vercel-cache        MISS 144   HIT 52
 *
 * Et la cascade ne s'arrête pas aux pages qui interrogent la base : `/cgu`,
 * `/mentions-legales`, `/a-propos` et `/confidentialite` — quatre pages
 * entièrement statiques — sont tombées dans le même sondage. Elles ne
 * demandent rien à Postgres ; elles attendaient simplement derrière des
 * requêtes qui, elles, n'avaient aucune raison de s'arrêter.
 *
 * C'est le mécanisme décrit dans l'audit comme « le serveur reste bloqué au
 * lieu de répondre ». Il ne venait ni des routes dynamiques ni des slugs
 * absents : `notFound()` était déjà appelé correctement partout. Il venait
 * d'ici, sous toutes les routes à la fois.
 *
 * ── Ce que fait la version présente ───────────────────────────────────────
 *
 * Chaque attente possible reçoit une borne, choisie pour qu'une saturation se
 * traduise par une erreur rapide plutôt que par un blocage :
 *
 *   `connectionTimeoutMillis` — au-delà, la requête renonce à obtenir une
 *   connexion. Une 500 en 5 s est un mauvais résultat ; une requête qui ne
 *   revient jamais en est un pire, parce qu'elle retient la place de toutes
 *   les suivantes. Google lit la première comme une erreur ponctuelle et la
 *   seconde comme un serveur en souffrance, et ne réduit son taux
 *   d'exploration que dans le second cas.
 *
 *   `statement_timeout` — borne côté serveur. `connectionTimeoutMillis` ne
 *   protège que l'attente *avant* d'obtenir une connexion ; une requête déjà
 *   partie et qui traîne garde la sienne indéfiniment, et c'est cette
 *   rétention qui vide le pool. Il faut les deux.
 *
 *   `max` — dix connexions pour une instance Fluid Compute, qui sert
 *   plusieurs requêtes concurrentes sur le même processus, était le plafond
 *   qu'on atteignait. L'endpoint Neon utilisé est déjà le `-pooler`
 *   (PgBouncer) : le vrai multiplexage se fait là-bas, et ce pool-ci n'a
 *   qu'à ne pas être le goulot.
 *
 * ── Le singleton, en production aussi ─────────────────────────────────────
 *
 * `globalForPrisma` n'était renseigné qu'en dehors de la production, l'idiome
 * répandu pour survivre au rechargement à chaud de `next dev`. En production
 * il ne coûtait rien tant qu'un module n'était évalué qu'une fois — mais le
 * runtime peut réévaluer un module (rendu serveur et route API dans des
 * graphes distincts), et chaque réévaluation ouvrait alors **un pool de plus**
 * sur la même instance, chacun avec ses dix connexions, sans que personne ne
 * les compte. Le singleton est désormais posé dans tous les environnements :
 * un pool par instance, c'est la seule quantité qu'on sait tenir.
 */
function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    // Attente maximale pour obtenir une connexion du pool.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    // Borne côté Postgres : une requête plus longue est annulée par le serveur,
    // qui rend la connexion au lieu de la garder. Aucune page publique n'a de
    // requête légitime à dix secondes.
    statement_timeout: 10_000,
    // Filet côté client, au cas où la connexion elle-même ne répondrait plus.
    query_timeout: 12_000,
  });

  /**
   * Une erreur sur un client *inactif* du pool — coupure réseau, redémarrage
   * de Neon — est émise sur le pool. Sans écouteur, Node la traite en
   * exception non capturée et arrête le processus, ce qui transforme un
   * incident réseau passager en instance perdue.
   */
  pool.on("error", (err) => {
    console.error("[prisma] erreur sur une connexion inactive du pool", err);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createOffering,
  createProProfile,
  publishProfile,
  refreshStripeStatus,
  startStripeOnboarding,
  toggleOffering,
} from "./actions";

export const dynamic = "force-dynamic";

const SERVICE_LABELS: Record<string, string> = {
  GARDE_DOMICILE: "Garde à domicile",
  GARDE_CHEZ_PRO: "Garde chez moi",
  PROMENADE: "Promenade",
};

export default async function ComptePetSitterPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const sp = await searchParams;
  if (sp.onboarding === "return" || sp.onboarding === "refresh") {
    await refreshStripeStatus();
  }

  const pro = await prisma.petProService.findUnique({
    where: { userId: session.user.id },
    include: { offerings: { orderBy: { createdAt: "desc" } } },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-extrabold font-['Manrope'] mb-2">Mon espace pet-sitter</h1>
      <p className="text-slate-600 mb-8">
        Proposez vos services de garde et de promenade — particulier passionné ou professionnel.
      </p>

      {!pro ? (
        <ProfileCreationForm />
      ) : (
        <div className="space-y-8">
          <ProfileSummary pro={pro} />
          <StripeOnboardingCard pro={pro} />
          {pro.kycCompletedAt && !pro.isPublished && <PublishCard />}
          {pro.kycCompletedAt && (
            <>
              <OfferingsList offerings={pro.offerings} />
              <CreateOfferingForm />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileCreationForm() {
  return (
    <form action={createProProfile} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-xl font-bold font-['Manrope']">Créer mon profil pet-sitter</h2>
      <p className="text-sm text-slate-500">
        Quelques informations pour démarrer. Vous pourrez les modifier ensuite.
      </p>

      <Field label="Nom affiché" name="displayName" placeholder="Marie L." required />
      <Field label="Ville" name="city" placeholder="Lyon" required />
      <Field label="Code postal" name="postalCode" placeholder="69001" />
      <TextArea
        label="Présentation"
        name="bio"
        placeholder="Quelques mots sur vous, votre expérience avec les animaux, votre logement…"
        required
      />

      <button
        type="submit"
        className="bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
      >
        Créer mon profil
      </button>
    </form>
  );
}

function ProfileSummary({ pro }: { pro: { displayName: string; city: string; slug: string; isPublished: boolean } }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Mon profil</div>
        <div className="text-lg font-bold">{pro.displayName}</div>
        <div className="text-sm text-slate-600">{pro.city}</div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            pro.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {pro.isPublished ? "En ligne" : "Brouillon"}
        </span>
        {pro.isPublished && (
          <Link
            href={`/pet/pro/${pro.slug}`}
            className="text-sm text-[#2f6fb8] hover:underline"
          >
            Voir mon profil public
          </Link>
        )}
      </div>
    </div>
  );
}

function StripeOnboardingCard({
  pro,
}: {
  pro: {
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
    kycCompletedAt: Date | null;
  };
}) {
  const done = !!pro.kycCompletedAt;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-['Manrope'] mb-1">Paiements (Stripe)</h2>
          <p className="text-sm text-slate-600">
            Pour recevoir des paiements, vérifiez votre identité via Stripe. C&apos;est rapide et sécurisé,
            que vous soyez particulier ou professionnel.
          </p>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {done ? "Vérifié" : "À faire"}
        </span>
      </div>

      <ul className="text-sm text-slate-600 mt-4 space-y-1">
        <li>
          <span className={pro.stripeAccountId ? "text-emerald-600" : "text-slate-400"}>●</span>{" "}
          Compte Stripe créé
        </li>
        <li>
          <span className={pro.stripeChargesEnabled ? "text-emerald-600" : "text-slate-400"}>●</span>{" "}
          Réception des paiements
        </li>
        <li>
          <span className={pro.stripePayoutsEnabled ? "text-emerald-600" : "text-slate-400"}>●</span>{" "}
          Virements vers votre compte bancaire
        </li>
      </ul>

      <form action={startStripeOnboarding} className="mt-5">
        <button
          type="submit"
          className="bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
        >
          {pro.stripeAccountId ? "Continuer la vérification" : "Démarrer la vérification Stripe"}
        </button>
      </form>
    </div>
  );
}

function PublishCard() {
  return (
    <form action={publishProfile} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center justify-between gap-4">
      <div>
        <h3 className="font-bold text-emerald-900">Tout est prêt ! Publiez votre profil</h3>
        <p className="text-sm text-emerald-800">Votre profil sera visible dans les résultats de recherche.</p>
      </div>
      <button
        type="submit"
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
      >
        Publier
      </button>
    </form>
  );
}

function OfferingsList({
  offerings,
}: {
  offerings: Array<{
    id: string;
    serviceType: string;
    title: string;
    priceCents: number;
    unit: string;
    maxPets: number;
    isActive: boolean;
  }>;
}) {
  if (offerings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm">
        Aucune prestation pour l&apos;instant.
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
      {offerings.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              {SERVICE_LABELS[o.serviceType] ?? o.serviceType}
            </div>
            <div className="font-bold">{o.title}</div>
            <div className="text-sm text-slate-600">
              {(o.priceCents / 100).toFixed(2)} € / {o.unit === "HOUR" ? "heure" : "jour"} · jusqu&apos;à {o.maxPets} animal{o.maxPets > 1 ? "x" : ""}
            </div>
          </div>
          <form action={async () => { "use server"; await toggleOffering(o.id, !o.isActive); }}>
            <button
              type="submit"
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                o.isActive
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {o.isActive ? "Active" : "Inactive"}
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

function CreateOfferingForm() {
  return (
    <form action={createOffering} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-xl font-bold font-['Manrope']">Ajouter une prestation</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 mb-1 block">Type de service</span>
          <select
            name="serviceType"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            defaultValue="GARDE_DOMICILE"
          >
            <option value="GARDE_DOMICILE">Garde à domicile (chez le client)</option>
            <option value="GARDE_CHEZ_PRO">Garde chez moi</option>
            <option value="PROMENADE">Promenade</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 mb-1 block">Unité</span>
          <select name="unit" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" defaultValue="DAY">
            <option value="DAY">Par jour</option>
            <option value="HOUR">Par heure</option>
          </select>
        </label>
      </div>

      <Field label="Titre" name="title" placeholder="Garde de chien à mon domicile" required />
      <TextArea label="Description" name="description" placeholder="Détaillez votre prestation, votre expérience…" required />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Prix (€)" name="priceEuros" type="number" step="0.01" min="1" required />
        <Field label="Nombre d'animaux max" name="maxPets" type="number" step="1" min="1" max="10" defaultValue="1" required />
      </div>

      <button
        type="submit"
        className="bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
      >
        Créer la prestation
      </button>
    </form>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  step?: string;
  min?: string;
  max?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 mb-1 block">{props.label}</span>
      <input
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6fb8]"
        type={props.type ?? "text"}
        name={props.name}
        placeholder={props.placeholder}
        required={props.required}
        step={props.step}
        min={props.min}
        max={props.max}
        defaultValue={props.defaultValue}
      />
    </label>
  );
}

function TextArea(props: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 mb-1 block">{props.label}</span>
      <textarea
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6fb8] min-h-[100px]"
        name={props.name}
        placeholder={props.placeholder}
        required={props.required}
      />
    </label>
  );
}

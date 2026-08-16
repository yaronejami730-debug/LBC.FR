import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ProNav from "../ProNav";
import { resolveProContext } from "@/lib/pro/access";
import { stockOf } from "@/lib/pro/inventory";
import StockBoard, { type ProductRow } from "./StockBoard";

export const metadata = { title: "Mon stock" };
export const dynamic = "force-dynamic";

/**
 * Le stock de l'établissement.
 *
 * Réservé à la capacité `inventory`. Un salon de coiffure n'a rien à faire ici
 * et n'y a pas de lien ; s'il tape l'URL, il est renvoyé vers la configuration
 * où il peut activer le stock s'il se met vraiment à vendre des produits.
 *
 * L'état du stock est calculé au rendu par `stockOf`, jamais lu dans une
 * colonne : « disponible » est une soustraction entre le présent et le réservé,
 * et une soustraction stockée est une soustraction qui finit fausse.
 */
export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/stock");

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);
  if (!context) redirect("/profile/espace-pro");
  if (!context.capabilities.includes("inventory")) redirect("/profile/espace-pro/configuration");

  const rows = await prisma.proProduct.findMany({
    where: { profileId: context.establishment.id },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      name: true,
      sku: true,
      section: true,
      price: true,
      status: true,
      quantity: true,
      reserved: true,
      unlimited: true,
      lowStockAt: true,
      variants: { select: { quantity: true, reserved: true, isActive: true } },
      listings: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true },
      },
    },
  });

  const products: ProductRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    section: p.section,
    price: p.price,
    status: p.status,
    lowStockAt: p.lowStockAt,
    unlimited: p.unlimited,
    stock: stockOf(p),
    listings: p.listings,
  }));

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <ProNav
          current="/profile/espace-pro/stock"
          slug={context.establishment.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={context.establishment.id}
        />

        <header className="mt-6 mb-5">
          <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Mon stock</h1>
          <p className="text-sm text-[#777683] mt-1">
            {context.establishment.name} — vos quantités disponibles, et l&apos;état des
            annonces qui en dépendent.
          </p>
        </header>

        <StockBoard products={products} />
      </main>
    </>
  );
}

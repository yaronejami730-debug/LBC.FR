"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function submitReview(bookingId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/mes-reservations");

  const rating = Math.max(1, Math.min(5, Number(formData.get("rating") ?? 0)));
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const booking = await prisma.petBooking.findUnique({
    where: { id: bookingId },
    include: { review: true },
  });
  if (!booking || booking.clientId !== session.user.id) throw new Error("Non autorisé");
  if (booking.status !== "COMPLETED") throw new Error("Prestation non terminée");
  if (booking.review) throw new Error("Avis déjà déposé");

  await prisma.petReview.create({
    data: {
      bookingId: booking.id,
      proServiceId: booking.proServiceId,
      authorId: session.user.id,
      rating,
      comment,
    },
  });

  // Recompute the pet-sitter's aggregate rating.
  const agg = await prisma.petReview.aggregate({
    where: { proServiceId: booking.proServiceId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.petProService.update({
    where: { id: booking.proServiceId },
    data: {
      avgRating: agg._avg.rating,
      reviewCount: agg._count._all,
    },
  });

  revalidatePath("/pet/mes-reservations");
}

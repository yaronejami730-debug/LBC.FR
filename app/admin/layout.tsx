import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";

export const metadata = { title: "Admin — PrèsDeToi" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;

  if (!session?.user) redirect("/login");
  if (role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar adminName={session.user.name ?? "Admin"} />
      <div className="ml-60 min-h-screen flex flex-col">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

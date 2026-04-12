import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import AdminMobileHeader from "@/components/admin/AdminMobileHeader";

export const metadata = { title: "Admin — Le Bon Deal" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session?.user || role !== "ADMIN") redirect("/admin/login");

  const adminName = session.user.name ?? "Admin";

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar adminName={adminName} />
      </div>

      {/* Mobile Top Bar */}
      <AdminMobileHeader adminName={adminName} />

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen flex flex-col transition-all duration-300">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

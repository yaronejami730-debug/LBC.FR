import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ConversationList from "./ConversationList";

export default async function MessagesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  return (
    <div className="bg-[#fbfcff] text-on-surface min-h-screen pb-24">
      <Navbar active="messages" />

      {/* Main Content Canvas */}
      <main className="pt-32 px-4 max-w-2xl mx-auto">
        {/* Editorial Header */}
        <div className="mb-8 px-2 flex items-end justify-between">
          <div>
            <span className="text-primary font-bold uppercase tracking-[0.15em] text-[10px] mb-1 block">Votre centre de</span>
            <h2 className="text-4xl font-black text-[#2f6fb8] tracking-tighter">Messages</h2>
          </div>
          <div className="hidden md:block">
            <p className="text-slate-400 text-sm font-medium">Gestion des conversations directes</p>
          </div>
        </div>

        {/* Chat List — real-time client component */}
        <ConversationList currentUserId={userId} />
      </main>

      <BottomNav active="messages" />
    </div>
  );
}

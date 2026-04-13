import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-presence";

const TTL_MS = 2_500; // session morte après 2.5s sans heartbeat

function cutoff() {
  return new Date(Date.now() - TTL_MS).toISOString();
}

// GET /api/presence?channel=xxx  →  { count: N }
export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel");
  if (!channel) return NextResponse.json({ error: "Missing channel" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { count } = await supabase
    .from("presence_sessions")
    .select("*", { count: "exact", head: true })
    .eq("channel", channel)
    .eq("role", "user")
    .gte("last_seen_at", cutoff());

  return NextResponse.json({ count: count ?? 0 });
}

// POST /api/presence  →  upsert session + { count: N }
export async function POST(req: NextRequest) {
  const { session_id, channel, role = "user" } = await req.json();
  if (!session_id || !channel) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  await supabase.from("presence_sessions").upsert(
    { session_id, channel, last_seen_at: now, role },
    { onConflict: "session_id,channel" }
  );

  await supabase.from("presence_sessions").delete().lt("last_seen_at", cutoff());

  const { count } = await supabase
    .from("presence_sessions")
    .select("*", { count: "exact", head: true })
    .eq("channel", channel)
    .eq("role", "user")
    .gte("last_seen_at", cutoff());

  return NextResponse.json({ count: count ?? 0 });
}

// DELETE /api/presence  →  supprime la session (déconnexion propre)
export async function DELETE(req: NextRequest) {
  const { session_id, channel } = await req.json();
  if (!session_id || !channel) return new NextResponse(null, { status: 204 });

  await supabaseAdmin()
    .from("presence_sessions")
    .delete()
    .eq("session_id", session_id)
    .eq("channel", channel);

  return new NextResponse(null, { status: 204 });
}

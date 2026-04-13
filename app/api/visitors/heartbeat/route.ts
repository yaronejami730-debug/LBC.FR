import { NextRequest, NextResponse } from "next/server";
import { registerVisitor, removeVisitor } from "@/lib/visitors";

// POST: visitor is active, or leaving (leave: true)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, leave } = body;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (leave) {
    removeVisitor(sessionId);
  } else {
    registerVisitor(sessionId);
  }
  return NextResponse.json({ ok: true });
}

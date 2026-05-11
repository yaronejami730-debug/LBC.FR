import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const expected = process.env.INDEXNOW_KEY;
  if (!expected) return new NextResponse("Not found", { status: 404 });
  if (key !== `${expected}.txt`) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(expected, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

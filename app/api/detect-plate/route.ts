import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const token = process.env.PLATE_RECOGNIZER_TOKEN;
  if (!token) return NextResponse.json({ boxes: [] });

  let fileBlob: Blob;
  let filename = "image.jpg";

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ boxes: [] });
    fileBlob = file;
    filename = file.name || "image.jpg";
  } else {
    const body = await req.json();
    if (!body.imageBase64) return NextResponse.json({ boxes: [] });
    const bytes = Uint8Array.from(atob(body.imageBase64), (c) => c.charCodeAt(0));
    fileBlob = new Blob([bytes], { type: body.mimeType || "image/jpeg" });
  }

  try {
    const prForm = new FormData();
    prForm.append("upload", fileBlob, filename);
    prForm.append("regions", "fr");

    const res = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
      body: prForm,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error("[PlateRecognizer] error:", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ boxes: [] });
    }

    const data = await res.json() as {
      results?: { box: { xmin: number; ymin: number; xmax: number; ymax: number } }[];
    };

    console.log("[PlateRecognizer] raw:", JSON.stringify(data));

    if (!data.results?.length) return NextResponse.json({ boxes: [] });

    // Return raw pixel coordinates — client uses directly on canvas (same coordinate space)
    const boxes = data.results.map((r) => ({
      xmin: r.box.xmin,
      ymin: r.box.ymin,
      xmax: r.box.xmax,
      ymax: r.box.ymax,
    }));

    return NextResponse.json({ boxes });
  } catch (err) {
    console.error("[PlateRecognizer] exception:", err);
    return NextResponse.json({ boxes: [] });
  }
}

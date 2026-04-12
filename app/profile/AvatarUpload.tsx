"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AvatarUpload({
  currentAvatar,
  initials,
}: {
  currentAvatar: string | null;
  initials: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatar);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      // 1. Upload the file
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const { url } = await uploadRes.json();

      // 2. Save the URL to the user profile
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url }),
      });

      setPreview(url);
      startTransition(() => router.refresh());
    } catch {
      setPreview(currentAvatar);
    } finally {
      setUploading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="relative w-20 h-20 flex-shrink-0 group"
      title="Changer la photo"
    >
      {preview ? (
        <img
          src={preview}
          alt="Avatar"
          className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/20"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-extrabold text-2xl font-['Manrope']">{initials}</span>
        </div>
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading ? (
          <span className="material-symbols-outlined text-white text-xl animate-spin">progress_activity</span>
        ) : (
          <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </button>
  );
}

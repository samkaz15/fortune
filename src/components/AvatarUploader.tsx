"use client";

import { useRef, useState } from "react";

/**
 * アバター設定(CEO要求 2026-07-07): 好きな画像をアイコンにできる。
 * クライアント側で256pxに縮小(canvas)→JPEG data URL→POST /api/profile/avatar。
 * 反映先: マイページの丸 / ヘッダーの人マーク。
 */
export function AvatarUploader({
  initialAvatar,
  fallbackChar,
}: {
  initialAvatar: string | null;
  fallbackChar: string;
}) {
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const dataUrl = await resizeToDataUrl(file, 256);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) throw new Error("upload failed");
      setAvatar(dataUrl);
      setMsg("アイコンを更新しました");
      window.dispatchEvent(new Event("avatar-updated")); // ヘッダーへ即時反映
    } catch {
      setMsg("画像の設定に失敗しました。別の画像でお試しください");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="アイコン" className="h-14 w-14 rounded-full border border-gold-500/40 object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 font-display text-lg text-gold-400">
          {fallbackChar}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-full border border-gold-500/50 px-4 py-1.5 text-xs font-bold text-gold-400 disabled:opacity-50"
        >
          {busy ? "設定中..." : avatar ? "画像を変更" : "好きな画像を設定"}
        </button>
        {msg && <span className="text-[10px] text-paper-400">{msg}</span>}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      </div>
    </div>
  );
}

function resizeToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      // 中央クロップで正方形に
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

"use client";

/**
 * 占い入力(名前・生年月日)の画面間引き継ぎ(要件③⑥ 2026-07-08)。
 * - 今日の運勢/自分のこと の診断開始時に保存
 * - 会員登録ページでのプレフィルと、登録完了後の再診断で再利用
 * タブを閉じれば消えるsessionStorageを使用(PIIをlocalStorageに永続化しない)。
 */

const KEY = "itomachi_fortune_input";

export interface FortuneInput {
  name: string;
  birthDate: string; // YYYY-MM-DD
}

export function saveFortuneInput(input: FortuneInput): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(input));
  } catch {
    /* プライベートモード等で保存できなくても機能は継続する */
  }
}

export function loadFortuneInput(): FortuneInput | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FortuneInput>;
    if (typeof parsed.name !== "string" || typeof parsed.birthDate !== "string") return null;
    return { name: parsed.name, birthDate: parsed.birthDate };
  } catch {
    return null;
  }
}

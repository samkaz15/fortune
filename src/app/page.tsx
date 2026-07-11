import Link from "next/link";
import { ScoreOrb } from "@/components/ScoreOrb";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { calculateShichu } from "@/lib/fortune-engine/shichu";

export const dynamic = "force-dynamic";

/** 今日のスコア: 本人の四柱wave(占いエンジン)。未ログインは日替わりの汎用値 */
async function todayScore(): Promise<number> {
  const d = new Date();
  const fallback = 55 + ((d.getDate() * 7 + d.getMonth() * 3) % 31);
  try {
    const userId = await getCurrentUserId();
    if (userId) {
      const p = await prisma.userProfile.findUnique({
        where: { userId },
        select: { birthDate: true },
      });
      if (p) return calculateShichu(p.birthDate).wave;
    }
  } catch {
    /* DB/セッション不調でもホームは必ず表示する(全ページの入口のため) */
  }
  return fallback;
}
import { SITE_NAME_EN } from "@/lib/site";
import { PopularRanking } from "@/components/PopularRanking";
import { HomeGreeting } from "@/components/HomeGreeting";
import { AffSlot } from "@/components/ui-common";

/**
 * 画面遷移設計書「TOP(ホーム)」の実装。
 * オンボーディング画面は作らず、Hero内のコピーだけでコンセプトを伝える設計方針(WBS判断済み)。
 * 実データ(今日の運気スコア/最新結果)は認証実装後にサーバーコンポーネントでfetchする形に差し替える。
 * 現状はログイン前でも迷わない導線を優先し、静的なプレースホルダーで構成している。
 */
export default async function TopPage() {
  const score = await todayScore();
  return (
    <div className="flex flex-col gap-8 px-5">
      <section className="relative -mx-5 overflow-hidden">
        {/* Hero全体の背景画像(2026-07-11修正: 「追加」ではなくHero全体を覆う背景として実装。
            absolute inset-0 + object-cover により、親sectionの実高さ(コンテンツに応じて可変)を
            常に隙間なく覆う。幅は親(max-w-mdの画面フレーム)いっぱいに広がる。 */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/character/milkyway_city.jpg"
            alt="天の川と都市の夜景"
            className="h-full w-full object-cover"
          />
          {/* 可読性確保のためのオーバーレイ(黒系グラデーション・上下2枚がけ) */}
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/35 via-ink-950/55 to-ink-950" />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-ink-950/40" />
        </div>

        {/* レイヤー: キャラクター・タイトル・CTAを画像の上に表示 */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-5 pb-8 pt-10 text-center">
          {/* OSのライト/ダーク設定で画像を切替(CEO指定 2026-07-06: ライト=朝/ダーク=夜) */}
          <picture className="block h-24 w-24 overflow-hidden rounded-full border-2 border-gold-400 shadow-lantern">
            <source srcSet="/character/home_light.jpg" media="(prefers-color-scheme: light)" />
            <img src="/character/home_dark.jpg" alt="錦糸町の少年" className="h-full w-full object-cover" />
          </picture>
          <p className="font-display text-sm tracking-[0.3em] text-gold-400 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            {SITE_NAME_EN}
          </p>
          <h1 className="font-display text-3xl leading-snug text-paper-50 [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
            <HomeGreeting />
          </h1>
          <p className="max-w-[26ch] text-sm leading-relaxed text-paper-100 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            生年月日と名前、そして毎日の対話から。今日どう動けばいいかを、迷わず決められるレポートを届けます。
          </p>

          {/* CTA(スコア+今日のひとこと+主導線ボタン)もHero内のレイヤーとして表示 */}
          <div className="mt-2 flex w-full flex-col items-center gap-4 rounded-card border border-white/10 bg-ink-950/45 px-6 py-6 backdrop-blur-sm">
            <ScoreOrb score={score} size={140} />
            <p className="text-center text-sm text-paper-100">
              今日は「流れに乗る」日。
              <br />
              焦らなくても大丈夫。
            </p>
            <Link
              href="/report"
              className="w-full rounded-full bg-gold-500 py-3 text-center font-bold text-ink-950 transition active:scale-[0.98]"
            >
              今日の自分の運勢レポートを見る
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base text-paper-200">相談する</h2>
        {/* LP方針(2026-07-06): 相談の入口はv4 LPへ。有料会員は/consult内で自動的に/reportへ振り分け */}
        <ConsultShortcut href="/auction" label="錦糸町の少年と直接話す(トークション)" />
        <div className="grid grid-cols-3 gap-3">
          <ConsultShortcut href="/self" label="自分のこと" />
          <ConsultShortcut href="/love" label="恋愛・相性" />
          <ConsultShortcut href="/work" label="仕事" />
        </div>
      </section>

      <AffSlot />

      <PopularRanking />

      <section className="rounded-card border border-torii-500/30 bg-ink-900/40 px-5 py-4">
        <h2 className="mb-2 font-display text-sm text-torii-500">週替わりオークション</h2>
        <p className="text-sm text-paper-400">個人面談占いチケットを1000円から入札できます。</p>
        <Link href="/auction" className="mt-3 inline-block text-sm font-bold text-gold-400 underline">
          オークションを見る →
        </Link>
      </section>

      <section className="rounded-card border border-ink-700 bg-ink-900/40 px-5 py-4">
        <h2 className="mb-2 font-display text-sm text-paper-200">運気カレンダー</h2>
        <p className="text-sm text-paper-400">1ヶ月分の運気の波と、今月やるべきことをまとめて確認できます。</p>
        <Link href="/calendar" className="mt-3 inline-block text-sm font-bold text-gold-400 underline">
          カレンダーを見る →
        </Link>
      </section>
          {/* アフィリエイト枠(ホームは最下部1枠のみ・UI仕様v5) */}
      <AffSlot />
</div>
  );
}

function ConsultShortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-card border border-ink-700 bg-ink-900/50 py-5 text-sm text-paper-200 transition active:scale-[0.98]"
    >
      {label}
    </Link>
  );
}

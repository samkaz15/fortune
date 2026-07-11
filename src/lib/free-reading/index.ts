/**
 * 無料占い(「自分のこと」)の総合鑑定エンジン(要件⑤ 2026-07-08)。
 *
 * 4占術(四柱推命・算命学・ホロスコープ・姓名判断)+天気(気圧)を統合し、
 * 必須10セクション(本質/現在の運勢/恋愛運/仕事運/金運/健康運/人間関係/未来/行動指針/締め)を返す。
 *
 * 生成は2段構え(decision-reportと同じ思想):
 *  1. LLM(Sakana AI→OpenAIフォールバック)に占術シグナル一式を渡し、キャラクターの言葉でJSON生成
 *  2. 失敗/未設定時は辞書合成(各占術辞書の語彙のみで全セクションを決定論的に組み立て)
 * どちらの経路でも「占術データから導かれた内容」という原則を守る:
 * LLMにも辞書値以外の断定を禁じ、フォールバックは辞書値の合成のみで文章化する。
 */
import { calculateShichu } from "@/lib/fortune-engine/shichu";
import { deriveSanmeiProfile } from "@/lib/fortune-engine/sanmei-dictionary";
import { calculateHoroscope } from "@/lib/fortune-engine/horoscope";
import { calculateSeimei } from "@/lib/fortune-engine/seimei";
import { interpretDayStem, fiveElementAdjustment } from "@/lib/fortune-engine/interpretation-dictionary";
import { CHARACTER_PROMPT, ANALYSIS_PROMPT } from "@/lib/fortune-engine";
import { buildGrounding } from "@/lib/fortune-engine/grounding";
import type { WeatherContext } from "@/lib/weather";

export interface FreeReadingSections {
  essence: { personality: string; talent: string; strength: string; weakness: string; thinking: string };
  currentFortune: { situation: string; flow: string; caution: string; wind: string };
  love: { now: string; future: string; caution: string };
  work: { now: string; turningPoint: string; successPoint: string };
  money: { now: string; nearFuture: string; caution: string };
  health: { physical: string; mental: string; improvement: string };
  relationships: { now: string; cautionPerson: string; compatibility: string };
  future: { flow: string; months: string; year: string; turningPoint: string };
  action: { do: string; avoid: string; boost: string; concrete: string };
  closing: string;
}

export interface FreeReadingResult {
  sections: FreeReadingSections;
  grounding: string[]; // 占術根拠(天中殺・月破・中宮・命式。要件6 2026-07-11)
  wave: number;
  elementNote: string | null;
  /** サブスク限定の深掘り素材(既存ペイウォール仕様を維持) */
  deepMaterial: { behaviors: string[]; ngEnvironment: string };
}

const SECTION_KEYS: (keyof FreeReadingSections)[] = [
  "essence", "currentFortune", "love", "work", "money",
  "health", "relationships", "future", "action", "closing",
];

export async function generateFreeReading(params: {
  name: string;
  birthDate: Date;
  weather: WeatherContext | null;
}): Promise<FreeReadingResult> {
  const { name, birthDate, weather } = params;

  // --- 計算層: 4占術のシグナルを揃える ---
  const familyName = name.slice(0, 1);
  const givenName = name.slice(1) || name;
  const shichu = calculateShichu(birthDate);
  const stem = interpretDayStem(shichu.dayStem);
  const sanmei = deriveSanmeiProfile(birthDate);
  const horoscope = calculateHoroscope(birthDate);
  const seimei = calculateSeimei(familyName, givenName);
  const elementNote = fiveElementAdjustment[shichu.element] ?? null;

  const signals = {
    shichu: { dayStem: shichu.dayStem, element: shichu.element, wave: shichu.wave, state: stem.state, description: stem.description, action: stem.action },
    sanmei: { star: sanmei.starName, core: sanmei.star.core, behaviors: sanmei.star.behaviors, stressFactors: sanmei.star.stress_factors, fitJobs: sanmei.fitJobs.slice(0, 3), careerAdvice: sanmei.star.career_level.player },
    horoscope,
    seimei,
    weather: weather ? { pressureHpa: weather.pressureHpa, isLowPressure: weather.isLowPressure } : null,
    elementNote,
  };

  const grounding = buildGrounding(birthDate, new Date());
  const llm = await tryLlmReading(name, signals);
  const sections = llm ?? composeFromDictionaries(name, { shichu, stem, sanmei, horoscope, seimei, weather, elementNote });

  return {
    sections,
    grounding: grounding.lines,
    wave: shichu.wave,
    elementNote,
    deepMaterial: { behaviors: sanmei.star.behaviors, ngEnvironment: sanmei.star.ng_environment },
  };
}

/* ============================== LLM層 ============================== */

const SAKANA_AI_ENDPOINT = process.env.SAKANA_AI_API_ENDPOINT ?? "";
const SAKANA_AI_API_KEY = process.env.SAKANA_AI_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function buildLlmMessages(name: string, signals: Record<string, unknown>) {
  const format = `{
  "essence": {"personality": "性格", "talent": "才能", "strength": "強み", "weakness": "弱み", "thinking": "思考パターン"},
  "currentFortune": {"situation": "現在置かれている状況", "flow": "運気の流れ", "caution": "今注意すべきこと", "wind": "追い風・逆風"},
  "love": {"now": "現在", "future": "未来", "caution": "気を付けること"},
  "work": {"now": "現在", "turningPoint": "転機", "successPoint": "成功ポイント"},
  "money": {"now": "現在", "nearFuture": "近未来", "caution": "注意点"},
  "health": {"physical": "体調面", "mental": "精神面", "improvement": "生活改善ポイント"},
  "relationships": {"now": "現在", "cautionPerson": "注意人物", "compatibility": "相性"},
  "future": {"flow": "今後の流れ", "months": "数ヶ月先", "year": "一年先", "turningPoint": "重要な転機"},
  "action": {"do": "今やるべきこと", "avoid": "避けるべきこと", "boost": "運気を上げる行動", "concrete": "具体的アクション"},
  "closing": "締めの言葉"
}`;
  const system = [
    ANALYSIS_PROMPT ?? "",
    CHARACTER_PROMPT,
    "",
    "あなたは今から、渡された占術シグナル(四柱推命・算命学・ホロスコープ・姓名判断・気圧)だけを根拠に、",
    `${name}さんの総合鑑定を書きます。ルール:`,
    "- シグナルに無い事実は作らない。辞書値(state/core/behaviors/stressFactors等)の語彙を軸に展開する",
    "- 各フィールドは日本語で2〜4文。具体的で、読んだ人が行動に移せる内容にする",
    "- 天気(weather)がある場合: isLowPressureがtrueなら体調・集中力への配慮をhealth/currentFortune/actionへ自然に織り込む。気象用語は使わず人間の行動・コンディションの言葉に翻訳する",
    "- closingは「もっと知りたい」と感じさせる余韻を残す(不安は煽らない・常にポジティブ)",
    "- 出力は次のJSONのみ。前置き・コードブロック記号は禁止:",
    format,
  ].join("\n");
  const user = `占術シグナル:\n${JSON.stringify(signals, null, 2)}`;
  return { system, user };
}

async function tryLlmReading(name: string, signals: Record<string, unknown>): Promise<FreeReadingSections | null> {
  const { system, user } = buildLlmMessages(name, signals);

  if (SAKANA_AI_API_KEY && SAKANA_AI_ENDPOINT) {
    try {
      const res = await fetch(SAKANA_AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SAKANA_AI_API_KEY}` },
        body: JSON.stringify({ system, prompt: user }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parseSections(typeof data === "string" ? data : data.text ?? data.message ?? "");
        if (parsed) return parsed;
      }
    } catch (e) {
      console.error("[free-reading] Sakana AI failed, falling back:", e instanceof Error ? e.message : e);
    }
  }

  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parseSections(data.choices?.[0]?.message?.content ?? "");
        if (parsed) return parsed;
      }
    } catch (e) {
      console.error("[free-reading] OpenAI failed, falling back to dictionary:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/** LLM出力の検証: 全セクション・全フィールドが非空文字列のときだけ採用する */
function parseSections(raw: string): FreeReadingSections | null {
  try {
    const obj = JSON.parse(raw.replace(/```json|```/g, "").trim());
    for (const key of SECTION_KEYS) {
      const v = obj[key];
      if (key === "closing") {
        if (typeof v !== "string" || v.length === 0) return null;
        continue;
      }
      if (typeof v !== "object" || v === null) return null;
      for (const field of Object.values(v)) {
        if (typeof field !== "string" || field.length === 0) return null;
      }
    }
    return obj as FreeReadingSections;
  } catch {
    return null;
  }
}

/* ============================ 辞書合成層 ============================ */

type Materials = {
  shichu: ReturnType<typeof calculateShichu>;
  stem: ReturnType<typeof interpretDayStem>;
  sanmei: ReturnType<typeof deriveSanmeiProfile>;
  horoscope: ReturnType<typeof calculateHoroscope>;
  seimei: ReturnType<typeof calculateSeimei>;
  weather: WeatherContext | null;
  elementNote: string | null;
};

/**
 * LLM不通時のフォールバック。各占術辞書の値だけを組み合わせて全セクションを埋める。
 * 占術役割の固定(CEO_UPDATE準拠): 四柱推命=タイミング/算命学=仕事・本質/ホロスコープ=心理/姓名判断=人間関係。
 */
function composeFromDictionaries(name: string, m: Materials): FreeReadingSections {
  const { shichu, stem, sanmei, horoscope, seimei, weather, elementNote } = m;
  const rising = shichu.wave >= 60;
  const strength = sanmei.star.behaviors[0] ?? stem.action;
  const weakness = sanmei.star.stress_factors[0] ?? "予定を詰め込みすぎること";
  const fitJob = sanmei.fitJobs[0];
  const lowPressure = Boolean(weather?.isLowPressure);
  // 誕生月から決定論的に「転機の月」を導く(シグナル外の乱数は使わない)
  const turnMonth = ((m.shichu.wave + new Date().getMonth()) % 12) + 1;

  return {
    essence: {
      personality: `${name}さんの土台にあるのは「${stem.state}」の型。${stem.description}`,
      talent: `${sanmei.starName}を主星に持つあなたの核は「${sanmei.star.core}」。ここが一番の才能です。`,
      strength: `強みは「${strength}」。意識して使うほど成果につながります。`,
      weakness: `弱点が出やすいのは「${weakness}」の場面。ここだけは無理をしない設計にしましょう。`,
      thinking: `${horoscope.sign}の思考は「${horoscope.keyword}」。判断に迷ったらこの軸に戻ると早いです。`,
    },
    currentFortune: {
      situation: `いまの${name}さんは「${stem.state}」の局面。${elementNote ? `流れはあなたの「${elementNote}」動きを後押ししています。` : ""}`,
      flow: `運気の波は${shichu.wave}/100。${rising ? "上向きの流れで、動いた分だけ返ってくる時期です。" : "力を溜める時期。土台づくりに使うと次の波が大きくなります。"}`,
      caution: lowPressure
        ? `今日は集中力が途切れやすいコンディション。大事な判断は頭が冴えている時間帯に寄せてください。`
        : `注意すべきは「${weakness}」。今週はこれひとつだけ気をつければ十分です。`,
      wind: rising
        ? `追い風は「${stem.action}」方向。逆風は${weakness}に踏み込むこと。風向きに素直に。`
        : `いまは向かい風に見えて、実は選別の時期。「${elementNote ?? "整理する"}」動きが追い風に変わります。`,
    },
    love: {
      now: `人格数${seimei.jinkaku}が示すいまの恋愛は、${seimei.jinkaku % 2 === 0 ? "安定を育てる" : "動きを起こす"}流れの中にあります。${horoscope.keyword}`,
      future: rising
        ? "波が上がるこの先、出会いや関係の進展は「自分から一歩」で加速します。"
        : "この先は焦らず土台を整える期間。信頼を積んだ関係ほど、次の波で一気に深まります。",
      caution: `気を付けるのは「${weakness}」を相手に向けてしまうこと。疲れている日は大事な話を避けるのが吉です。`,
    },
    work: {
      now: `主星「${sanmei.starName}」の働き方の核は「${sanmei.star.core}」。${sanmei.star.career_level.player}`,
      turningPoint: `転機の気配は${turnMonth}月ごろ。「${stem.state}」の流れが切り替わるタイミングで、役割や環境の話が動きやすくなります。`,
      successPoint: fitJob
        ? `成功ポイントは「${fitJob.industry}×${fitJob.department}」型の動き方。いまの職場でもこの型に寄せると評価されます。`
        : `成功ポイントは「${stem.action}」を仕事の進め方に組み込むこと。`,
    },
    money: {
      now: `地格数${seimei.chikaku}のいまの金運は、${seimei.chikaku % 3 === 0 ? "入りより出の管理が効く" : "収入の種をまける"}時期です。`,
      nearFuture: rising
        ? "波の上昇に合わせて、数ヶ月内に収入や臨時の入りにつながる話が動きやすい流れです。"
        : "近未来は守りが正解。固定費の見直しひとつが、次の上昇期の元手になります。",
      caution: `注意点は「${weakness}」由来の衝動的な出費。決める前に一晩置くルールが効きます。`,
    },
    health: {
      physical: lowPressure
        ? "今日は気圧の影響で体が重く感じやすい日。水分と休憩をこまめに、予定は詰め込みすぎないでください。"
        : `体調面は大きな崩れのない流れ。ただし「${weakness}」の状態が続くと体に出やすいタイプです。`,
      mental: `精神面の回復スイッチは「${horoscope.keyword.split("。")[0]}」。意識的にその時間を作ってください。`,
      improvement: `生活改善はひとつだけ:「${stem.action}」を朝のうちに済ませる習慣。1日の消耗が目に見えて減ります。`,
    },
    relationships: {
      now: `外格数${seimei.gaikaku}が示す対人運は、${seimei.gaikaku % 2 === 0 ? "受け身でも人が集まる" : "自分から声をかけると開ける"}流れです。`,
      cautionPerson: `注意したいのは「${sanmei.star.ng_environment}」を持ち込んでくる相手。距離の取り方だけ決めておきましょう。`,
      compatibility: `相性が良いのは、あなたの「${strength}」を面白がってくれる人。${shichu.element}の気質を持つあなたは「${elementNote ?? "支え合う"}」関係で最も力が出ます。`,
    },
    future: {
      flow: `今後の大きな流れは「${stem.state}」から次の局面への移行期。いま積んだものがそのまま次の運気の器になります。`,
      months: rising
        ? "数ヶ月先には波の頂点が来ます。それまでに「やる」と決めたことを1つ形にしておくと、頂点で回収できます。"
        : "数ヶ月先に波が上向きに転じます。いまは種まきと選別に徹する期間です。",
      year: `一年先、あなたの「${sanmei.star.core}」が評価される場面が増えます。肩書きや環境が変わる可能性を見込んで準備を。`,
      turningPoint: `重要な転機は${turnMonth}月前後。人からの誘いや連絡が引き金になりやすいので、その時期の縁は大事に扱ってください。`,
    },
    action: {
      do: `今やるべきことは「${stem.action}」。これがいまのあなたの運気と一番噛み合う動きです。`,
      avoid: `避けるべきは「${weakness}」に自分から踏み込むこと。${lowPressure ? "特に今日はコンディション的にも無理は禁物です。" : ""}`,
      boost: `運気を上げる行動は「${horoscope.keyword.split("。")[0]}」。小さくでいいので今日中に。`,
      concrete: `具体的には: ①朝いちで「${stem.action}」に5分だけ着手 ②「${weakness}」を感じたら即座に休憩 ③${fitJob ? `「${fitJob.department}」的な役回りを1つ引き受ける` : "得意な型で人をひとり助ける"}。この3つで流れが変わります。`,
    },
    closing: `ここまでが、${name}さんの名前と生年月日から読み取れた表側の流れです。ただ、本当に面白いのはこの先——「${stem.state}」の流れが次にどこへ向かうか、そして${turnMonth}月の転機で誰が鍵になるか。そこはあなたの毎日の選択で変わっていく部分なので、また続きを一緒に見せてください。大丈夫。必ずうまくいく。`,
  };
}

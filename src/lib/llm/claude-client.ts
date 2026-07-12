/**
 * Claude API 共通クライアント (CEOアーキテクチャ指示 2026-07-12: 「LLM処理はClaude APIに集約」)
 *
 * Sakana AI(sakana-ai-adapter.ts)を置き換える。画像生成はGemini(別モジュール、対象外)。
 * 用途: 意思決定レポート・無料占い・チャット応答生成の全LLM呼び出しをここに一本化する。
 *
 * 呼び出し先: api.anthropic.com/v1/messages(公式Anthropic API)。
 * 未設定(ANTHROPIC_API_KEY無し)の環境ではnullを返し、呼び出し元は決定論フォールバックへ倒す
 * (このプロダクト全体の設計原則: LLM不在でも占術データからの合成で必ず結果を返す)。
 */

export const CLAUDE_MODEL = "claude-sonnet-4-6"; // Anthropic API向けモデル文字列(製品名の"Sonnet 5"とは表記が異なる)

export interface ClaudeCallOptions {
  systemPrompt: string;
  userInput: unknown;
  maxTokens?: number;
  /** 会話継続(チャット用)。省略時はuserInputのみの単発呼び出し */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Claude APIを1回呼び、テキスト応答を返す。失敗時はnull(呼び出し元でフォールバック)。
 * JSON強制が必要な呼び出し元は、systemPrompt側で「JSONのみを出力」を指示し、
 * 呼び出し後に自前でparse+zod検証すること(このクライアントは生テキストを返すのみ)。
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const messages = [
    ...(opts.history ?? []),
    { role: "user" as const, content: typeof opts.userInput === "string" ? opts.userInput : JSON.stringify(opts.userInput) },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: opts.maxTokens ?? 1024,
          system: opts.systemPrompt,
          messages,
        }),
      });
      if (!res.ok) continue; // 429/5xx等はリトライ、リトライも尽きたらnull
      const data = await res.json();
      const text = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");
      return text || null;
    } catch {
      // ネットワーク断等はリトライへ
    }
  }
  return null;
}

/** JSON応答を期待する呼び出し向けの薄いラッパー。パース失敗時もnull(フォールバックへ) */
export async function callClaudeJson<T>(opts: ClaudeCallOptions, parse: (raw: unknown) => T | null): Promise<T | null> {
  const text = await callClaude(opts);
  if (!text) return null;
  try {
    // コードブロック記法で返ってきた場合の保険(system promptでは禁止指示するが二重の防御)
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    return parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

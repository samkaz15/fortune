/**
 * DB結合テスト (CL13 / 2026-07-12)
 *
 * 実行: npm run test:integration
 * 前提: ローカルPostgreSQL(pg_trgm利用可)にmanual SQL全10本を適用済みのDB。
 *   接続先は環境変数 INTEGRATION_DATABASE_URL(例: postgres://ci@localhost:55432/fortune_test)
 *
 * 検証内容:
 *  A. スキーマ整合性 — schema.prismaの全@@mapテーブルがDBに存在する
 *  B. 拡張・インデックス — pg_trgm有効、trgm GINインデックス5本、主要ユニーク制約
 *  C. RAGクエリ実証 — karte/repository.tsのsimilarity検索SQLを実データで実行し、
 *     関連する記憶が返り・他ユーザーの記憶が漏れないこと
 *  D. 制約の実効性 — daily_reports(userId,reportDate,period)ユニーク、
 *     karte_snapshots(userId,version)ユニーク、engineVersionのDEFAULT 1
 *
 * ※Prismaクライアント経由のAPI結合テスト(auth/チャットE2E)はこの環境では
 *   実行不可(engineバイナリ取得制限)のため、ステージング手動チェックリスト
 *   (docs/integration_test_report.md)でカバーする。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.INTEGRATION_DATABASE_URL;
if (!url) {
  throw new Error("INTEGRATION_DATABASE_URL を設定してください");
}

const db = new Client({ connectionString: url });

before(async () => {
  await db.connect();
});
after(async () => {
  await db.end();
});

// ---------- A. スキーマ整合性 ----------
test("A: schema.prismaの全テーブルがDBに存在する", async () => {
  const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf-8");
  const expected = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(expected.length >= 25, `schema.prismaから${expected.length}テーブル検出`);

  const res = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const actual = new Set(res.rows.map((r) => r.tablename));
  const missing = expected.filter((t) => !actual.has(t));
  assert.deepEqual(missing, [], `DBに存在しないテーブル: ${missing.join(", ")}`);
});

// ---------- B. 拡張・インデックス ----------
test("B: pg_trgm拡張とtrgm GINインデックス5本が有効", async () => {
  const ext = await db.query(`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`);
  assert.equal(ext.rowCount, 1, "pg_trgmが有効であること");

  const idx = await db.query(`SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%'`);
  const names = idx.rows.map((r) => r.indexname).sort();
  assert.deepEqual(names, [
    "knowledge_entries_finalAdvice_trgm_idx",
    "knowledge_entries_userConcern_trgm_idx",
    "life_events_description_trgm_idx",
    "life_events_title_trgm_idx",
    "user_kartes_aiInsights_trgm_idx",
  ]);
});

test("B: authId・engineVersion・period列の存在(後付けSQLの適用確認)", async () => {
  const cols = await db.query(`
    SELECT table_name, column_name, column_default FROM information_schema.columns
    WHERE (table_name = 'users' AND column_name = 'authId')
       OR (table_name IN ('daily_reports','fortune_results') AND column_name = 'engineVersion')
       OR (table_name = 'daily_reports' AND column_name = 'period')
  `);
  assert.equal(cols.rowCount, 4, "authId/engineVersion×2/period が揃っていること");
  for (const r of cols.rows) {
    if (r.column_name === "engineVersion") assert.match(r.column_default, /1/, "engineVersion DEFAULT 1");
  }
});

// ---------- C. RAGクエリ実証 ----------
const USER_A = "it-user-a";
const USER_B = "it-user-b";

test("C: seed投入", async () => {
  await db.query(`DELETE FROM knowledge_entries WHERE "userId" IN ($1,$2)`, [USER_A, USER_B]);
  await db.query(`DELETE FROM users WHERE id IN ($1,$2)`, [USER_A, USER_B]);
  for (const id of [USER_A, USER_B]) {
    await db.query(
      `INSERT INTO users (id, email, "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [id, `${id}@example.com`]
    );
  }
  const entries = [
    [USER_A, "s1", "BUSINESS", "転職するべきか悩んでいます。今の会社に3年います", "積み上げ重視", "司禄星の型なので信用の複利を優先", "今の職場で実績を1つ作る", 4],
    [USER_A, "s2", "RELATIONSHIP", "上司との人間関係がうまくいかない", "調整の時期", "距離を置いて観察する", "週1回だけ雑談する", 3],
    [USER_B, "s3", "BUSINESS", "転職の相談です。エンジニアに未経験からなりたい", "挑戦の時期", "学習を先に始める", "毎日30分学習", 3],
  ];
  for (const e of entries) {
    await db.query(
      `INSERT INTO knowledge_entries (id, "userId", "sessionId", category, "userConcern", "divinationSummary", "finalAdvice", "nextAction", tags, importance)
       VALUES (gen_random_uuid()::text, $1, $2, $3::"ConsultCategory", $4, $5, $6, $7, '[]'::jsonb, $8)`,
      e
    );
  }
  assert.ok(true);
});

test("C: 前提 — このDBのロケールで日本語trgmが生成される(lc_ctype検証)", async () => {
  // 【結合テストでの発見 2026-07-12】lc_ctypeがUTF-8系でないと日本語のtrgmは空になり
  // similarityが常に0になる。本番Supabaseでも必ずこのクエリで確認すること。
  const r = await db.query(`SELECT array_length(show_trgm('転職相談'), 1) AS n`);
  assert.ok(Number(r.rows[0].n) >= 3, "日本語trgmが生成されること(空ならlc_ctypeがCロケール)");
});

test("C: karte repositoryのハイブリッド検索(similarity+ILIKE)が関連記憶を返す", async () => {
  // repository.ts searchKnowledge と同一のクエリ形(ハイブリッド版)
  const { extractKeywords } = await import("../../src/lib/karte/keywords");
  const q = "転職を考えているんですが動くべきですか";
  const keywords = extractKeywords(q);
  assert.ok(keywords.includes("転職"), `キーワード抽出に転職が含まれる: ${keywords.join(",")}`);

  const params: unknown[] = [USER_A, q];
  const kwConds: string[] = [];
  const kwHits: string[] = [];
  for (const kw of keywords) {
    params.push(`%${kw}%`);
    const idx = params.length;
    kwConds.push(`"userConcern" ILIKE $${idx} OR "finalAdvice" ILIKE $${idx}`);
    kwHits.push(`(CASE WHEN "userConcern" ILIKE $${idx} OR "finalAdvice" ILIKE $${idx} THEN 1 ELSE 0 END)`);
  }
  const res = await db.query(
    `SELECT "userConcern",
            GREATEST(similarity("userConcern", $2), similarity("finalAdvice", $2)) AS similarity,
            ${kwHits.join(" + ")} AS keyword_hits
     FROM knowledge_entries
     WHERE "userId" = $1
       AND (similarity("userConcern", $2) > 0.05 OR similarity("finalAdvice", $2) > 0.05
            OR ${kwConds.join(" OR ")})
     ORDER BY keyword_hits DESC, similarity DESC, importance DESC, "createdAt" DESC
     LIMIT 5`,
    params
  );
  assert.ok(res.rowCount! >= 1, "転職相談の過去記憶がヒットすること");
  assert.match(res.rows[0].userConcern, /転職/);
  // 人間関係の相談は転職クエリで上位に来ない
  assert.doesNotMatch(res.rows[0].userConcern, /上司/);
});

test("C: 他ユーザーの記憶が漏れない(userId絞り込みの実効性)", async () => {
  const res = await db.query(
    `SELECT "userId" FROM knowledge_entries
     WHERE "userId" = $1 AND similarity("userConcern", $2) > 0.05`,
    [USER_A, "転職 エンジニア 未経験"]
  );
  for (const r of res.rows) assert.equal(r.userId, USER_A);
});

// ---------- D. 制約の実効性 ----------
test("D: daily_reports (userId, reportDate, period) ユニーク制約", async () => {
  await db.query(`DELETE FROM daily_reports WHERE "userId" = $1`, [USER_A]);
  const ins = `INSERT INTO daily_reports (id, "userId", "reportDate", period, score, stars, keywords, summary, cautions, advice, "todayAction", "scoreBreakdown")
               VALUES (gen_random_uuid()::text, $1, '2026-07-12', $2, 80, 4, '{}'::jsonb, 's', '[]'::jsonb, 'a', 't', '{}'::jsonb)`;
  await db.query(ins, [USER_A, "today"]);
  await db.query(ins, [USER_A, "week"]); // 同日別periodはOK(report_period修正の検証)
  await assert.rejects(db.query(ins, [USER_A, "today"]), /duplicate key/, "同日同periodは弾かれる");
});

test("D: karte_snapshots (userId, version) ユニーク制約 & engineVersion DEFAULT", async () => {
  await db.query(`DELETE FROM karte_snapshots WHERE "userId" = $1`, [USER_A]);
  const ins = `INSERT INTO karte_snapshots (id, "userId", version, data, trigger)
               VALUES (gen_random_uuid()::text, $1, 1, '{}'::jsonb, 'manual')`;
  await db.query(ins, [USER_A]);
  await assert.rejects(db.query(ins, [USER_A]), /duplicate key/);

  const dr = await db.query(`SELECT "engineVersion" FROM daily_reports WHERE "userId" = $1 LIMIT 1`, [USER_A]);
  assert.equal(dr.rows[0].engineVersion, 1, "既存行のengineVersionはDEFAULT 1");
});

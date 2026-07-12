/**
 * 算命学インデックス辞書のローダー + 主星導出（UX2/UX7 本実装）
 *
 * prompts/analysis/sanmei_index.v1.json（十大主星/十二大従星/組み合わせ/職業マッピング）を読み込み、
 * 生年月日から算出した日干支をもとに「本質の型」と「相性のよい業界×部署」を返す。
 *
 * D-11案B(2026-07-12): 主星は日干×月干の通変星から導出する方式へ正式化済み。
 * 蔵干を用いた人体星図の完全再現はPhase2(監修者と対照表確定後)。
 */
import fs from "node:fs";
import path from "node:path";
import { calculateFourPillars } from "./shichu";
import { shuseiOf } from "./tsuhensei";

export interface MajorStar {
  core: string;
  behaviors: string[];
  stress_factors: string[];
  job_categories: string[];
  ng_environment: string;
  career_level: { player: string; manager: string; executive: string };
}

interface JobMappingEntry {
  best: string[];
  good: string[];
  detail: Record<string, string>;
}

interface SanmeiIndex {
  ten_major_stars: Record<string, MajorStar>;
  twelve_energy_stars: Record<string, { energy: string; role: string; career_stage: string }>;
  combination_rules: Record<string, unknown>;
  job_mapping: Record<string, JobMappingEntry>;
}

let cached: SanmeiIndex | null = null;

function loadIndex(): SanmeiIndex {
  if (cached) return cached;
  const p = path.join(process.cwd(), "prompts", "analysis", "sanmei_index.v1.json");
  cached = JSON.parse(fs.readFileSync(p, "utf-8")) as SanmeiIndex;
  return cached;
}

export interface SanmeiProfile {
  starName: string;
  star: MajorStar;
  /** この主星と相性のよい業界×部署（best/good から detail を逆引き） */
  fitJobs: { industry: string; department: string; grade: "best" | "good" }[];
}

/**
 * 生年月日 → 主星プロファイル（本質＋業界×部署の相性）。
 * D-11案B(2026-07-12): 旧来の「日干→主星」1:1簡易対応を廃止し、
 * 日干×月干の通変星から十大主星を導出する方式(tsuhensei.ts)へ差し替え。
 */
export function deriveSanmeiProfile(birthDate: Date, birthTime?: string | null): SanmeiProfile {
  const fp = calculateFourPillars(birthDate, birthTime);
  const starName = shuseiOf(fp.day.index % 10, fp.month.index % 10);
  const index = loadIndex();
  const star = index.ten_major_stars[starName];

  // 業界×部署の逆引き: job_mappingの各detailから、この主星が割り当てられた部署を集める
  const fitJobs: SanmeiProfile["fitJobs"] = [];
  for (const [industry, entry] of Object.entries(index.job_mapping)) {
    const grade: "best" | "good" | null = entry.best.includes(starName)
      ? "best"
      : entry.good.includes(starName)
        ? "good"
        : null;
    if (!grade) continue;
    for (const [department, assignedStar] of Object.entries(entry.detail)) {
      if (assignedStar === starName) fitJobs.push({ industry, department, grade });
    }
  }
  // best優先で並べる
  fitJobs.sort((a, b) => (a.grade === b.grade ? 0 : a.grade === "best" ? -1 : 1));

  return { starName, star, fitJobs };
}

/** 主星辞書全体を返す（プロンプト供給用） */
export function getSanmeiIndex(): SanmeiIndex {
  return loadIndex();
}

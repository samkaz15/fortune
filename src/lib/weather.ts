/**
 * 天気連携(CL12)。低気圧かどうかを判定し、占術エンジンに渡すコンテキストを作る。
 * 外部天気API(Open-Meteo等、無料枠のあるものを想定)の呼び出しを想定したスタブ。
 * データレイヤー設計書の方針通り、Redisで短期キャッシュ(数時間)する。
 */
import { redis } from "./redis";

export interface WeatherContext {
  pressureHpa: number;
  isLowPressure: boolean;
}

const LOW_PRESSURE_THRESHOLD_HPA = 1005;
const CACHE_TTL_SECONDS = 60 * 60 * 3; // 3時間

export async function getWeatherContext(lat: number, lon: number): Promise<WeatherContext | null> {
  const cacheKey = `weather:${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const cached = await redis.get<WeatherContext>(cacheKey);
  if (cached) return cached;

  try {
    // Open-Meteo等、無料枠のある気象APIを想定(要:本番での採用先確定)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=surface_pressure`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();
    const pressureHpa: number = data?.current?.surface_pressure ?? 1013;

    const context: WeatherContext = {
      pressureHpa,
      isLowPressure: pressureHpa < LOW_PRESSURE_THRESHOLD_HPA,
    };
    await redis.set(cacheKey, context, { ex: CACHE_TTL_SECONDS });
    return context;
  } catch {
    // 天気連携は必須機能ではないため、失敗しても占い本体は止めない
    return null;
  }
}

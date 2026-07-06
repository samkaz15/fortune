"use client";

import { useEffect, useState } from "react";

/**
 * ホーム挨拶（3軸スコアリング）を表示するクライアント小コンポーネント（UX5）。
 * /api/home/greeting を叩き、天気(気圧)×四柱推命の総合で挨拶文を出し分ける。
 * 位置情報は任意（取得できなくても汎用挨拶で動く）。
 */
export function HomeGreeting() {
  const [greeting, setGreeting] = useState<string>("今日は、元気そうだね！");

  useEffect(() => {
    const fetchGreeting = (coords?: { lat: number; lon: number }) => {
      const qs = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : "";
      fetch(`/api/home/greeting${qs}`)
        .then((r) => r.json())
        .then((d) => d?.greeting && setGreeting(d.greeting))
        .catch(() => {});
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchGreeting({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => fetchGreeting()
      );
    } else {
      fetchGreeting();
    }
  }, []);

  return <span>{greeting}</span>;
}

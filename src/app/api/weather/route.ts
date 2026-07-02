import { NextRequest, NextResponse } from "next/server";
import { getWeatherContext } from "@/lib/weather";

/** GET /api/weather?lat=..&lon=.. — TOPページの「今日の占い」表示で使う軽量エンドポイント */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "INVALID_COORDS" }, { status: 400 });
  }
  const context = await getWeatherContext(lat, lon);
  return NextResponse.json(context ?? { pressureHpa: null, isLowPressure: false });
}

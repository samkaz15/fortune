#!/bin/bash
# CL29: 簡易負荷試験(重要エンドポイントの並列アクセス)
# 使い方: BASE_URL=http://localhost:3000 CONCURRENCY=20 REQUESTS=200 bash scripts/load_test.sh
set -u
BASE_URL="${BASE_URL:-http://localhost:3000}"
CONCURRENCY="${CONCURRENCY:-20}"
REQUESTS="${REQUESTS:-200}"
ENDPOINTS=("/api/health" "/" "/plans" "/shrines")

echo "== load test: $REQUESTS req x c=$CONCURRENCY =="
for ep in "${ENDPOINTS[@]}"; do
  start=$(date +%s.%N)
  seq "$REQUESTS" | xargs -P "$CONCURRENCY" -I{} curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL$ep" > /tmp/lt_codes.txt
  end=$(date +%s.%N)
  dur=$(echo "$end - $start" | bc)
  ok=$(grep -c "^200$" /tmp/lt_codes.txt || true)
  rps=$(echo "scale=1; $REQUESTS / $dur" | bc)
  echo "$ep : ${ok}/${REQUESTS} ok, ${dur%.*}s, ${rps} req/s"
done

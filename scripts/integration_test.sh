#!/bin/bash
# ==========================================================
# CL13: 結合テスト — 主要ユーザーフローをAPIレベルで検証する
# 前提: next start -p 3100 が起動済み、ローカルPostgres稼働中
# ==========================================================
BASE=http://localhost:3100
PASS=0; FAIL=0
JAR=/tmp/cookies.txt
rm -f $JAR

echo "===== 0. テストデータのクリーンアップ ====="
PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -q -c \
  "TRUNCATE users, user_profiles, fortune_sessions, fortune_messages, fortune_results, daily_usages, subscriptions, credit_balances, credit_transactions, auction_tickets, bids, notification_settings, notification_logs, audit_logs, point_balances, point_transactions, shrines, shrine_reviews, daily_reports, knowledge_entries RESTART IDENTITY CASCADE;" > /dev/null
echo "  (DBを初期化しました)"

check() {  # $1=テスト名 $2=期待値 $3=実際値
  if [ "$2" == "$3" ]; then PASS=$((PASS+1)); echo "✅ PASS: $1 (=$3)";
  else FAIL=$((FAIL+1)); echo "❌ FAIL: $1 (expected=$2, got=$3)"; fi
}

echo "===== 1. 画面疎通(未ログイン) ====="
for path in "/" "/consult" "/plans" "/auction" "/news" "/auth/login" "/auth/signup" "/legal/terms" "/legal/privacy" "/legal/tokushoho"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  check "GET $path" "200" "$code"
done

echo "===== 2. 認証ガード(未ログインで保護APIを叩く) ====="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" -H "Content-Type: application/json" -d '{"category":"TODAY","message":"テスト"}')
check "POST /api/chat 未ログイン→401" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/credit")
check "POST /api/billing/credit 未ログイン→401" "401" "$code"

echo "===== 3. 新規登録 → ログイン状態確立 ====="
code=$(curl -s -c $JAR -o /tmp/signup.json -w "%{http_code}" -X POST "$BASE/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"password123","familyName":"糸町","givenName":"太郎","birthDate":"1995-05-15","gender":"male","displayName":"たろう"}')
check "POST /api/auth/signup" "200" "$code"

code=$(curl -s -b $JAR -o /dev/null -w "%{http_code}" "$BASE/mypage")
check "GET /mypage ログイン済→200" "200" "$code"

echo "===== 4. 占いチャット(会員仕様v5: 無料会員=1回/日) ====="
code=$(curl -s -b $JAR -o /tmp/chat_TODAY.json -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"category":"TODAY","message":"最近どうすればいいか迷っています"}')
check "無料会員1回目→200" "200" "$code"
code=$(curl -s -b $JAR -o /tmp/free2.json -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" -d '{"category":"SELF","message":"2回目です"}')
check "無料会員2回目→402(もっと占う誘導)" "402" "$code"
cta=$(python3 -c "import json;print(json.load(open('/tmp/free2.json'))['cta']['label'])")
check "CTA=もっと占う" "もっと占う" "$cta"
note=$(python3 -c "import json;print('初月500円' in json.load(open('/tmp/free2.json'))['cta']['note'])")
check "CTA注記に初月500円" "True" "$note"

# 有料会員化(DB直接)して、カテゴリ別ルーティング+5回/日を検証
USER_ID=$(PGPASSWORD=itomachi_dev psql -h localhost -U itomachi -d itomachi -tA -c \
  "SELECT id FROM users ORDER BY \"createdAt\" DESC LIMIT 1")
PGPASSWORD=itomachi_dev psql -h localhost -U itomachi -d itomachi -c \
  "INSERT INTO subscriptions (id, \"userId\", status, \"planPriceJpy\", \"currentPeriodEnd\", \"createdAt\", \"updatedAt\")
   VALUES (gen_random_uuid()::text, '$USER_ID', 'active', 980, now() + interval '30 days', now(), now())"
echo "  (有料会員化: $USER_ID)"
for cat in SELF BUSINESS RELATIONSHIP; do
  code=$(curl -s -b $JAR -o /tmp/chat_$cat.json -w "%{http_code}" -X POST "$BASE/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"category\":\"$cat\",\"message\":\"最近どうすればいいか迷っています\"}")
  check "有料会員 POST /api/chat category=$cat" "200" "$code"
done

RESULT_ID=$(python3 -c "import json; print(json.load(open('/tmp/chat_TODAY.json'))['resultId'])")
echo "  (resultId: $RESULT_ID)"

echo "===== 5. crisis検知(安全フィルタ) ====="
res=$(curl -s -b $JAR -X POST "$BASE/api/chat" -H "Content-Type: application/json" \
  -d '{"category":"SELF","message":"もう死にたいです"}')
is_crisis=$(echo "$res" | python3 -c "import json,sys; print(json.load(sys.stdin).get('isCrisis'))")
check "crisis検知 isCrisis=True" "True" "$is_crisis"
has_hotline=$(echo "$res" | python3 -c "import json,sys; print('いのちの電話' in json.load(sys.stdin)['message'])")
check "crisis応答に相談窓口を含む" "True" "$has_hotline"

echo "===== 6. 診断結果の取得とペイウォール ====="
code=$(curl -s -o /tmp/result.json -w "%{http_code}" "$BASE/api/fortune/result/$RESULT_ID")
check "GET /api/fortune/result/:id (未ログインでも閲覧可)" "200" "$code"
unlocked=$(python3 -c "import json; print(json.load(open('/tmp/result.json'))['isUnlocked'])")
check "未課金→isUnlocked=False" "False" "$unlocked"
body=$(python3 -c "import json; print(json.load(open('/tmp/result.json'))['bodyText'])")
check "未課金→bodyText非公開(None)" "None" "$body"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/result/$RESULT_ID")
check "GET /result/:id 画面表示" "200" "$code"

echo "===== 7. 有料会員の1日5回制限(ここまで4回消費: TODAY+SELF+BUSINESS+RELATIONSHIP) ====="
# crisis検知はquota消費前に発動するため消費に含まれない。5回目は成功するはず
code=$(curl -s -b $JAR -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" -d '{"category":"TODAY","message":"5回目の質問"}')
check "5回目→200" "200" "$code"
code=$(curl -s -b $JAR -o /tmp/quota.json -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" -d '{"category":"TODAY","message":"6回目の質問"}')
check "6回目→402(quota切れ)" "402" "$code"

echo "===== 8. オークション入札フロー(100円刻み・楽観ロック) ====="
# テスト用チケットをDBに直接投入
TICKET_ID=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "INSERT INTO auction_tickets (id, title, description, \"startPriceJpy\", \"currentPriceJpy\", status, \"opensAt\", \"closesAt\", version) VALUES (gen_random_uuid(), 'テスト面談枠', '公式LINE電話 1時間', 1000, 1000, 'open', NOW(), NOW() + INTERVAL '24 hours', 0) RETURNING id;" | grep -E '^[0-9a-f-]{36}$')
echo "  (ticketId: $TICKET_ID)"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auction")
check "GET /api/auction 一覧" "200" "$code"

# 100円未満の刻みで入札→拒否されるはず
code=$(curl -s -b $JAR -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/auction/bid" \
  -H "Content-Type: application/json" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"amountJpy\":1100,\"expectedVersion\":0}")
check "同意チェックなしの入札→400(サーバー側検証)" "400" "$code"

# 現在価格(1000円)未満→BID_TOO_LOW
code=$(curl -s -b $JAR -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/auction/bid" \
  -H "Content-Type: application/json" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"amountJpy\":900,\"expectedVersion\":0,\"agreedNoCancel\":true,\"agreedDisclaimer\":true}")
check "現在価格未満の入札→409" "409" "$code"

# 現在価格以上(トークション仕様: +100円刻みは廃止)→成功
code=$(curl -s -b $JAR -o /tmp/bid_ok.json -w "%{http_code}" -X POST "$BASE/api/billing/auction/bid" \
  -H "Content-Type: application/json" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"amountJpy\":1100,\"expectedVersion\":0,\"agreedNoCancel\":true,\"agreedDisclaimer\":true}")
check "入札1100円(同意あり)→200" "200" "$code"

# 古いversionで入札→楽観ロック競合として拒否
code=$(curl -s -b $JAR -o /tmp/bid_conflict.json -w "%{http_code}" -X POST "$BASE/api/billing/auction/bid" \
  -H "Content-Type: application/json" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"amountJpy\":1300,\"expectedVersion\":0,\"agreedNoCancel\":true,\"agreedDisclaimer\":true}")
check "古いversionで入札→409(楽観ロック)" "409" "$code"
err=$(python3 -c "import json; print(json.load(open('/tmp/bid_conflict.json'))['error'])")
check "競合エラー種別=BID_CONFLICT" "BID_CONFLICT" "$err"

# トークション: ポーリング用ステータスAPI
code=$(curl -s -b $JAR -o /tmp/ta_status.json -w "%{http_code}" "$BASE/api/auction/status?ticketId=$TICKET_ID")
check "GET /api/auction/status →200" "200" "$code"
top=$(python3 -c "import json; d=json.load(open('/tmp/ta_status.json')); print(d['isTopBidder'] and d['currentPriceJpy']==1100)")
check "ステータス: 自分がトップ・価格1100円" "True" "$top"

# トークション: レビュー一覧(公開)
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auction/reviews")
check "GET /api/auction/reviews →200" "200" "$code"

# トークション: 終了処理cron(認証なし→401 / あり→200)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auction/close")
check "終了処理 認証なし→401" "401" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auction/close" -H "Authorization: Bearer test-cron-secret")
check "終了処理 cron実行→200" "200" "$code"

echo "===== 9. 退会フロー ====="
code=$(curl -s -b $JAR -o /dev/null -w "%{http_code}" -X POST "$BASE/api/account/cancel")
check "POST /api/account/cancel" "200" "$code"
deleted=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "SELECT (\"deletedAt\" IS NOT NULL) FROM users WHERE email='test1@example.com';")
check "退会後 deletedAt が設定される(論理削除)" "t" "$deleted"

echo ""
echo "=============================================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
echo "=============================================="

# ==========================================================
# Phase2 (CL15〜CL22) 追加テスト
# ==========================================================
echo ""
echo "########## Phase2 結合テスト (CL23) ##########"
JAR2=/tmp/cookies2.txt
rm -f $JAR2

echo "===== P2-1. 相性診断+相手情報(CL15) ====="
curl -s -c $JAR2 -o /dev/null -X POST "$BASE/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"email":"phase2@example.com","password":"password123","familyName":"山田","givenName":"花子","birthDate":"1998-08-08","gender":"female","displayName":"はなこ"}'
code=$(curl -s -b $JAR2 -o /tmp/compat.json -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"category":"COMPATIBILITY","message":"彼との相性が知りたい","partner":{"familyName":"佐藤","givenName":"健","birthDate":"1996-03-03"}}')
check "相性診断+partner情報→200" "200" "$code"

echo "===== P2-2. 運気カレンダー(CL16) ====="
code=$(curl -s -b $JAR2 -o /tmp/cal.json -w "%{http_code}" "$BASE/api/calendar?year=2026&month=7")
check "GET /api/calendar" "200" "$code"
days=$(python3 -c "import json; print(len(json.load(open('/tmp/cal.json'))['days']))")
check "7月は31日分のスコア" "31" "$days"
advice=$(python3 -c "import json; print(bool(json.load(open('/tmp/cal.json'))['monthlyAdvice']))")
check "毎月やるべきことが含まれる" "True" "$advice"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/calendar")
check "GET /calendar 画面" "200" "$code"

echo "===== P2-3. 通知設定・95点通知評価(CL17) ====="
code=$(curl -s -b $JAR2 -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/notifications/settings" \
  -H "Content-Type: application/json" -d '{"scoreThreshold":90}')
check "PATCH 通知しきい値90に変更" "200" "$code"
th=$(curl -s -b $JAR2 "$BASE/api/notifications/settings" | python3 -c "import json,sys; print(json.load(sys.stdin)['scoreThreshold'])")
check "しきい値が保存されている" "90" "$th"
# CRON_SECRET無しで叩くと401
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/notifications/evaluate")
check "通知評価 認証なし→401" "401" "$code"
# 正しいシークレットで実行
code=$(curl -s -o /tmp/eval.json -w "%{http_code}" -X POST "$BASE/api/notifications/evaluate" \
  -H "Authorization: Bearer test-cron-secret")
check "通知評価バッチ実行→200" "200" "$code"
evaluated=$(python3 -c "import json; d=json.load(open('/tmp/eval.json')); print(d['evaluated'] >= 1)")
check "評価対象ユーザーが存在" "True" "$evaluated"

echo "===== UX. 特設ページ・挨拶(本実装) ====="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/home/greeting")
check "GET /api/home/greeting →200" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/love")
check "GET /love ページ→200" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/work")
check "GET /work ページ→200" "200" "$code"
code=$(curl -s -o /tmp/love.json -w "%{http_code}" -X POST "$BASE/api/love/reading" -H "Content-Type: application/json" -d '{"name":"糸子","partnerName":"太郎"}')
check "POST /api/love/reading →200" "200" "$code"
locked=$(python3 -c "import json;print(json.load(open('/tmp/love.json'))['deep']['locked'])")
check "恋愛: 非会員は深層ロック" "True" "$locked"
code=$(curl -s -o /tmp/work.json -w "%{http_code}" -X POST "$BASE/api/work/reading" -H "Content-Type: application/json" -d '{"name":"糸子","birthDate":"2000-01-01","situation":"少し疲れている"}')
check "POST /api/work/reading →200" "200" "$code"
locked=$(python3 -c "import json;print(json.load(open('/tmp/work.json'))['future']['locked'])")
check "仕事: 非会員は将来相性ロック" "True" "$locked"

echo "===== P2-4. 神社API(CL18) ====="
# テスト用神社を投入
SHRINE_ID=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "INSERT INTO shrines (id, name, prefecture, city, tags, \"generalInfo\") VALUES (gen_random_uuid(), 'テスト稲荷神社', '東京都', '糸町', '[\"金運\",\"仕事運\"]', '由緒あるテスト神社です。') RETURNING id;" | grep -E '^[0-9a-f-]{36}$')
PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -q -c \
  "INSERT INTO shrine_reviews (id, \"shrineId\", \"authorType\", \"visitedAt\", blocks) VALUES (gen_random_uuid(), '$SHRINE_ID', 'ceo', NOW(), '{\"block1\":\"朝の光の中、鳥居をくぐった瞬間に空気が変わった。\",\"block3\":\"この場所の気は、動き出す人の背中を押してくれる。\",\"block5\":\"ぜひ参詣して、糸町の少年に感想を話しかけてみて。\"}');"
code=$(curl -s -b $JAR2 -o /tmp/shrines.json -w "%{http_code}" "$BASE/api/shrines")
check "GET /api/shrines" "200" "$code"
has_reco=$(python3 -c "import json; d=json.load(open('/tmp/shrines.json')); print(d['recommendation'] is not None)")
check "ログイン済→おすすめ神社が返る" "True" "$has_reco"
has_badge=$(python3 -c "import json; d=json.load(open('/tmp/shrines.json')); print(d['shrines'][0]['hasCeoReview'])")
check "CEO参拝レビューバッジ" "True" "$has_badge"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/shrines/$SHRINE_ID")
check "神社詳細画面(レビュー5ブロック表示)" "200" "$code"

echo "===== P2-5. 推薦ロジック(CL19) ====="
# 結果画面に「あわせて見られている診断」が表示されるか(k<20なのでfallbackが動くはず)
RESULT_ID2=$(python3 -c "import json; print(json.load(open('/tmp/compat.json'))['resultId'])")
body=$(curl -s "$BASE/result/$RESULT_ID2")
has_reco_card=$(echo "$body" | grep -c "あわせて見られている診断" || true)
check "結果画面に推薦カード表示(fallback動作)" "1" "$has_reco_card"

echo "===== P2-6. 紹介制度・ポイント(CL20) ====="
code=$(curl -s -b $JAR2 -o /tmp/ref.json -w "%{http_code}" "$BASE/api/referral")
check "GET /api/referral コード発行" "200" "$code"
REF_CODE=$(python3 -c "import json; print(json.load(open('/tmp/ref.json'))['referralCode'])")
echo "  (referralCode: $REF_CODE)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/invite/$REF_CODE")
check "招待着地ページはv5で廃止→404" "404" "$code"
# 招待経由で新規登録
curl -s -c /tmp/cookies3.txt -o /dev/null -X POST "$BASE/api/auth/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"invited@example.com\",\"password\":\"password123\",\"familyName\":\"招待\",\"givenName\":\"次郎\",\"birthDate\":\"2000-01-01\",\"displayName\":\"じろう\",\"referralCode\":\"$REF_CODE\"}"
inviter_pts=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "SELECT pb.balance FROM point_balances pb JOIN users u ON u.id = pb.\"userId\" WHERE u.email='phase2@example.com';")
check "招待側に1ポイント付与" "1" "$inviter_pts"
invited_pts=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "SELECT pb.balance FROM point_balances pb JOIN users u ON u.id = pb.\"userId\" WHERE u.email='invited@example.com';")
check "被招待側に1ポイント付与" "1" "$invited_pts"

echo "===== P2-7. ポイント消費チェーン(v5: 有料会員のみ 枠切れ→ポイント→クレジット) ====="
# v5仕様: 無料会員は枠切れ後ポイントがあってもサブスク誘導(402)。有料化してから検証する
P2_ID=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -tA -c \
  "SELECT id FROM users WHERE email='phase2@example.com'")
PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -c \
  "INSERT INTO subscriptions (id, \"userId\", status, \"planPriceJpy\", \"currentPeriodEnd\", \"createdAt\", \"updatedAt\")
   VALUES (gen_random_uuid()::text, '$P2_ID', 'active', 980, now() + interval '30 days', now(), now())"
# 有料枠(5回/日)が尽きるまで投げ続けると、尽きた瞬間にポイント(残高1)が自動消費されusedPoint=Trueが返る
used_point=None
for i in 1 2 3 4 5 6 7 8; do
  res=$(curl -s -b $JAR2 -X POST "$BASE/api/chat" -H "Content-Type: application/json" \
    -d '{"category":"TODAY","message":"追加の質問'$i'"}')
  up=$(echo "$res" | python3 -c "import json,sys; print(json.load(sys.stdin).get('usedPoint'))" 2>/dev/null)
  if [ "$up" = "True" ]; then used_point=True; break; fi
done
check "有料会員: 枠切れ→ポイント自動消費" "True" "$used_point"
# ポイントも尽きた次は402
code=$(curl -s -b $JAR2 -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" -d '{"category":"TODAY","message":"もう無理なはず"}')
check "ポイントも切れ→402" "402" "$code"

echo "===== P2-8. ランキング(CL21) ====="
code=$(curl -s -o /tmp/rank.json -w "%{http_code}" "$BASE/api/ranking")
check "GET /api/ranking" "200" "$code"
has_rank=$(python3 -c "import json; d=json.load(open('/tmp/rank.json')); print(len(d['popularRanking']) >= 1)")
check "人気診断ランキングにデータあり" "True" "$has_rank"

echo "===== P2-9. LINE誘導(CL22簡略版) ====="
# 自前連携APIは廃止(外部公式LINEへのhrefリンク誘導のみ)。API routeが存在しないことを確認
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/line/link")
check "旧連携API廃止済み→404" "404" "$code"
code=$(curl -s -b $JAR2 -o /dev/null -w "%{http_code}" "$BASE/mypage/notifications")
check "通知設定画面(LINE誘導リンク含む)表示" "200" "$code"

echo ""
echo "=============================================="
echo "TOTAL RESULT: PASS=$PASS FAIL=$FAIL"
echo "=============================================="

# ==========================================================
# 意思決定レポート (CEO_UPDATE 2026-07-03) テスト
# ==========================================================
echo ""
echo "########## 意思決定レポート テスト ##########"

echo "===== R-1. 認証・前提条件 ====="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/report/today")
check "未ログイン→401" "401" "$code"

echo "===== R-2. レポート生成(6項目フォーマット) ====="
code=$(curl -s -b $JAR2 -o /tmp/report.json -w "%{http_code}" "$BASE/api/report/today")
check "GET /api/report/today" "200" "$code"
python3 - <<'PYEOF' > /tmp/report_checks.txt
import json
r = json.load(open('/tmp/report.json'))
print("score_valid", 5 <= r['score'] <= 100)
print("stars_valid", 1 <= r['stars'] <= 5)
print("keywords_3", all(k in r['keywords'] for k in ('userTheme','environment','fortune')))
print("cautions_3", len(r['cautions']) == 3)
print("summary_len", 100 <= len(r['summary']) <= 300)
print("action_single", bool(r['todayAction']))
import re
banned = re.search(r'低気圧|高気圧|気圧|hPa', json.dumps(r, ensure_ascii=False))
print("no_weather_terms", banned is None)
PYEOF
while read name result; do
  check "レポート: $name" "True" "$result"
done < /tmp/report_checks.txt

echo "===== R-3. 同日2回目はキャッシュ返却(スコア不変) ====="
score1=$(python3 -c "import json; print(json.load(open('/tmp/report.json'))['score'])")
curl -s -b $JAR2 -o /tmp/report2.json "$BASE/api/report/today"
score2=$(python3 -c "import json; print(json.load(open('/tmp/report2.json'))['score'])")
check "2回目のスコアが同一(決定論+キャッシュ)" "$score1" "$score2"
count=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "SELECT COUNT(*) FROM daily_reports;")
check "DBに1件のみ保存(二重生成なし)" "1" "$count"

echo "===== R-4. RAG知識ベース(会話ログの構造化) ====="
ke_count=$(PGPASSWORD=itomachi_dev psql -h 127.0.0.1 -U itomachi -d itomachi -t -A -c \
  "SELECT COUNT(*) FROM knowledge_entries;")
ke_ok=$(python3 -c "print(int('$ke_count') >= 1)")
check "チャット完了時にKnowledgeEntryが生成されている" "True" "$ke_ok"

echo ""
echo "=============================================="
echo "FINAL RESULT: PASS=$PASS FAIL=$FAIL"
echo "=============================================="

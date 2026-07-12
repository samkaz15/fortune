# ヒーロー画像 生成指示書(Gemini API・10枚) — 2026-07-12

対象: CEO(明日の作業用) / 受け皿実装: 完了済み(`src/lib/hero-image.ts` + `HeroImage.tsx`)
配置先: `public/character/hero/`(**ファイル名は下表と完全一致させること** — マニフェストと1:1対応)

## 仕組み(30秒)

レポートの**スコア×時間帯(JST)**で10枚を自動で出し分けます。同じ日は同じ画像(チラつき防止)。
**1枚ずつ追加してOK** — 未配置分は既存の`report_hero.jpg`に自動フォールバックするので、
10枚揃うまでサイトが壊れることはありません。追加したらgit push(またはGitHub Web UIでアップロード)するだけです。

## 共通スタイル指定(全10枚のプロンプトに必ず含める)

```
アニメ調のやわらかいイラスト。主人公は「錦糸町の少年」— 小柄な少年と相棒の小さな緑のカエル。
七夕の世界観(夜空・星・天の川・短冊・笹)を基調とする。横長 3:1 構図(1536x512px)、
被写体は中央やや上(画面下1/3はUIで隠れるため重要要素を置かない)。
文字・ロゴ・透かしは入れない。実在の人物・ブランドを描かない。温かく安心感のある色調。
```

※スタイル一貫性のため、**1枚目を生成したらその画像を参照画像として2枚目以降に渡す**(Geminiの
image-to-image)か、同じセッションで連続生成してください。

## 10枚のブリーフ(ファイル名=この通りに保存)

| # | ファイル名 | 出る条件 | 個別プロンプト(共通指定に追記) |
|---|---|---|---|
| 1 | hero_01_sunrise_charge.png | スコア80+・朝 | 朝焼けの空へ駆け出す少年。カエルが肩の上。追い風、旗めく短冊。躍動感 |
| 2 | hero_02_celebration_stars.png | スコア90+ | 流れ星が降る夜空に両手を上げて喜ぶ少年とジャンプするカエル。祝祭感、金色の粒子 |
| 3 | hero_03_tanabata_wish.png | 60-89 | 笹に短冊を結ぶ少年。カエルが短冊をくわえて手伝う。願いを込める静かな高揚 |
| 4 | hero_04_milkyway_calm.png | 60-89・夜 | 天の川を見上げて座る少年とカエル。穏やかで満ち足りた夜 |
| 5 | hero_05_lantern_evening.png | 45-79・夜 | 提灯の灯る夕暮れの縁側。少年がお茶、カエルが団子。ほっとする時間 |
| 6 | hero_06_kinshicho_bridge.png | 45-79・昼 | 下町の橋の上を歩く少年とカエル。スカイツリーが遠景に小さく。日常の冒険 |
| 7 | hero_07_reading_scroll.png | 30-59・昼 | 巻物(暦)を広げて読み込む少年。カエルが虫眼鏡。学びと準備の日 |
| 8 | hero_08_rain_frog.png | 0-44・昼 | 大きな葉っぱの傘で雨宿りする2人。雨でもどこか楽しげ。慎重に過ごす日 |
| 9 | hero_09_quiet_moon.png | 0-44・夜 | 三日月の下、布団で眠る少年と隣で丸くなるカエル。休むことも運のうち |
| 10 | hero_10_morning_mist.png | 30-69・朝 | 朝霧の中で靴紐を結ぶ少年。カエルが背伸び。静かな仕込みの朝 |

## Gemini APIスクリプト雛形(ローカル実行用)

```bash
# 前提: GEMINI_API_KEY を取得(Google AI Studio)。モデル名は実行時点の画像生成対応モデルを
# ai.google.dev のドキュメントで確認して差し替えること(下記は雛形)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/<IMAGE_MODEL>:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"<共通スタイル指定+個別プロンプト>"}]}],
       "generationConfig":{"responseModalities":["IMAGE"]}}' \
  | python3 -c "import json,sys,base64; d=json.load(sys.stdin); \
    open('hero_01_sunrise_charge.png','wb').write(base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data']))"
```

## 受け入れチェック(1枚ごと)

- [ ] 3:1横長・下1/3に重要要素なし(実画面はh-36のobject-coverで上30%基準に切られる)
- [ ] 文字・透かしなし / 実在ブランドなし
- [ ] ファイル名が表と完全一致(1文字でも違うとフォールバックのまま)
- [ ] 配置→push→レポート画面で該当スコア帯の日に表示されることを確認

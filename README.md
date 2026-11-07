# 魔古工坊（MoguWorkshop）

`mabinogi.elden-mogu.com` 上的瑪奇台服工具站：主頁、mogugi 發佈頁、人偶計算機入口。純靜態網站，以 Cloudflare Workers 靜態資源部署，只接手部分路徑，其餘照舊走 tunnel。

設計：`docs/superpowers/specs/2026-11-07-moguworkshop-design.md`

## 開發

```bash
npm install
npm test          # 主題、導覽與頁面結構檢查
npm run dev       # 本機預覽 http://localhost:8787/
npm run dev:proxy # 本機預覽 http://localhost:8788/，/mabilat/api/* 轉到正式站（唯讀）；MABILAT_API=http://localhost:8765 改接本機 mabilat
```

`public/` 就是網站根目錄；共用外觀在 `public/_shared/`（`site.css`、`theme.js`、`nav.js`）。

## 部署

```bash
npx wrangler login   # 第一次才需要，會開瀏覽器授權 Cloudflare 帳號
npm test
npm run deploy
```

`wrangler.jsonc` 只把下列路徑交給這個 Worker，其餘（`/mabilat/`、`/mabilat/api/*`、`/health`、`/mogugi/auth/*` 等）照舊走 tunnel 到 CamaUbuntu：

- `mabinogi.elden-mogu.com/`
- `mabinogi.elden-mogu.com/doll`、`/doll/`
- `mabinogi.elden-mogu.com/mabilat`、`/mabilat/`（`/mabilat/api/*` 不在內，照舊走 tunnel 到 mabilat）
- `mabinogi.elden-mogu.com/mogugi`、`/mogugi/`
- `mabinogi.elden-mogu.com/_shared/*`

所以頁面專屬的 JS／CSS／圖片要放在 `public/_shared/<頁面>/` 底下（例如 `public/_shared/mogugi/`），放在 `public/mogugi/xxx.js` 線上會 404。

新增頁面時，路由必須是精確路徑；不要用 `mabinogi.elden-mogu.com/*`，也不要用 `custom_domain`，否則會蓋掉主機上的其他服務。`npm test` 會檢查路由清單。

部署後確認（其他服務的回應要跟部署前相同）：

```bash
for p in / /doll/ /mogugi/ /mabilat/api/health /_shared/site.css /mabilat/ /mabilat/api/health /health /mogugi/auth/exchange /mogugi/ops/alert; do
  printf '%s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' https://mabinogi.elden-mogu.com$p)"
done
```

預期：`/`、`/doll/`、`/mogugi/` 是 200 HTML，`/_shared/site.css` 是 200 CSS；`/mabilat/`、`/mabilat/api/health`、`/health` 是 200；`/mogugi/auth/exchange`、`/mogugi/ops/alert` 是 405（supermogugi，沒被 Worker 攔走）。

## mogugi 發佈頁的資料

- 版本資料讀 `https://cdn.elden-mogu.com/mogugi/releases.json`，由 mogugi repo 的 `discord-release.yml`（job `releases-json`）在發版、修改 release、或手動 `json_only` 執行時產生、上傳 R2、只清該網址快取並驗證；失敗會發到私人頻道（supermogugi `POST /mogugi/ops/alert`）。網站這邊不用做任何事。
- R2 桶 `elden-mogu-public` 的 CORS 只允許 `https://mabinogi.elden-mogu.com` 與 `http://localhost:8787` GET／HEAD。
- 截圖在 `public/_shared/mogugi/shots/*.webp`（1600px 寬）。換圖：同檔名覆蓋即可；新增功能要在 `public/mogugi/index.html` 的 `#features` 加一張 `.feat` 卡片（自動出現在輪播分頁）。

## 撤回

- **回到上一版頁面**：`npx wrangler deployments list` 找到版本，再 `npx wrangler rollback <version-id>`。
- **整個撤下、讓網址回到 tunnel**：刪掉 `wrangler.jsonc` 的 `routes` 後 `npm run deploy`；或在 Cloudflare 後台 elden-mogu.com → Workers Routes 刪除這幾條路由。

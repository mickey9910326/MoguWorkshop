# 魔古工坊（MoguWorkshop）

`mabinogi.elden-mogu.com` 上的瑪奇台服工具站：主頁、mogugi 發佈頁、人偶計算機入口。純靜態網站，以 Cloudflare Workers 靜態資源部署，只接手部分路徑，其餘照舊走 tunnel。

設計：`docs/superpowers/specs/2026-11-07-moguworkshop-design.md`

## 開發

```bash
npm install
npm test          # 主題、導覽與頁面結構檢查
npm run dev       # 本機預覽 http://localhost:8787/
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
- `mabinogi.elden-mogu.com/_shared/*`

新增頁面時，路由必須是精確路徑；不要用 `mabinogi.elden-mogu.com/*`，也不要用 `custom_domain`，否則會蓋掉主機上的其他服務。`npm test` 會檢查路由清單。

部署後確認（其他服務的回應要跟部署前相同）：

```bash
for p in / /doll/ /_shared/site.css /mabilat/ /mabilat/api/health /health /mogugi/auth/exchange; do
  printf '%s %s
' "$p" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' https://mabinogi.elden-mogu.com$p)"
done
```

預期：`/`、`/doll/` 是 200 HTML，`/_shared/site.css` 是 200 CSS；`/mabilat/`、`/mabilat/api/health`、`/health` 是 200，`/mogugi/auth/exchange` 是 405。

## 撤回

- **回到上一版頁面**：`npx wrangler deployments list` 找到版本，再 `npx wrangler rollback <version-id>`。
- **整個撤下、讓網址回到 tunnel**：刪掉 `wrangler.jsonc` 的 `routes` 後 `npm run deploy`；或在 Cloudflare 後台 elden-mogu.com → Workers Routes 刪除這幾條路由。

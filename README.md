# 魔古工坊（MoguWorkshop）

`mabinogi.elden-mogu.com` 上的瑪奇台服工具站：主頁、mogugi 發佈頁、mabilat 延遲頁、人偶計算機入口。純靜態網站，以 Cloudflare Workers 靜態資源部署。

## 開發

```bash
npm install
npm test          # 主題、導覽與頁面結構檢查
npm run dev       # 本機預覽 http://localhost:8787/
npm run dev:proxy # 本機預覽 http://localhost:8788/，mabilat API 轉到正式站
```

要改接本機 mabilat：設 `MABILAT_API=http://localhost:8765`，mabilat 用 `python -m mabilat serve --port 8765 --base-path /mabilat` 啟動。

`public/` 就是網站根目錄；共用外觀在 `public/_shared/`（`site.css`、`theme.js`、`nav.js`）。

Worker 只接手 `wrangler.jsonc` 列出的精確路徑，所以頁面專屬的 JS／CSS／圖片要放在 `public/_shared/<頁面>/` 底下（例如 `public/_shared/mogugi/`），放在 `public/mogugi/xxx.js` 線上會 404。新增頁面時路由也必須是精確路徑，不要用萬用字元或 `custom_domain`；`npm test` 會檢查路由清單。

## 部署

```bash
npx wrangler login   # 第一次才需要
npm test
npm run deploy
```

回到上一版：`npx wrangler deployments list` 找到版本，再 `npx wrangler rollback <version-id>`。

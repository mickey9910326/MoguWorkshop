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
npm run deploy
```

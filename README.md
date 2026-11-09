# 魔古工坊（MoguWorkshop）

`mabinogi.elden-mogu.com` 上的瑪奇台服工具站：主頁、mogugi 發布頁、mabilat 延遲頁、人偶計算機入口。

網站：https://mabinogi.elden-mogu.com/

## 流量統計（Umami）

自架在 CamaUbuntu（`/home/cama/umami/`，compose 檔留一份在 `deploy/umami/compose.yaml`），經既有的 cloudflared tunnel 對外：`https://umami.elden-mogu.com` → `HTTP localhost:3000`。

- 每頁 `<head>` 載入 `https://umami.elden-mogu.com/mw.js`，`data-domains` 只算正式網域，本機開發不計。追蹤 script 與上傳端點（`/api/mw`）改過名，避開擋廣告外掛對 umami 預設路徑的封鎖。
- Discord 連結各有 `data-umami-event`：導覽列一律 `discord-nav`（`page` 屬性記點擊的頁面），其餘為 `discord-home`、`discord-doll`、`discord-mogugi`、`discord-mogugi-report`、`discord-mogugi-oauth`、`discord-mogugi-steps`。
- 新增頁面或 Discord 連結時，`tests/site.test.mjs` 會檢查有沒有漏掉 script 或事件名稱。

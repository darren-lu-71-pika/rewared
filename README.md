# 謎題獎勵式廣告測試頁

這是一個純前端的靜態試作頁，用來測試「使用者點按鈕後，透過 Google Ad Manager 的 rewarded ad 解鎖答案」這個流程。

## 目前已填入的廣告單元

目前 [script.js](./script.js) 已經先填入你提供的 ad unit path：

```js
adUnitPath: "/21634903505/test20260"
```

## 重要提醒

你貼給我的那段 GPT 程式碼，是一般 `display slot` 的寫法，重點像這樣：

```html
googletag.defineSlot('/21634903505/test20260', [WIDTH, HEIGHT], 'div-id')
```

但這個專案目前做的是「按按鈕後，用 rewarded ad 解鎖答案」的流程，所以我這邊是只拿你的 `ad unit path` 來接到 rewarded ad 骨架裡。

也就是說：

- 我已經把廣告單元路徑幫你填進去了
- 但如果 `GAM` 後台的這個單元其實只是一般展示型廣告，而不是 `rewarded ad for web` 可用的單元，那頁面不一定會成功出現獎勵式廣告

## 如果之後你要換別的 ad unit

打開 [script.js](./script.js)，把這段：

```js
adUnitPath: "/21634903505/test20260"
```

換成你自己的 Google Ad Manager 廣告單元路徑，例如：

```js
adUnitPath: "/1234567/puzzle/rewarded_unlock"
```

## GitHub Pages 上線檢查清單

1. 把這些檔案推到 GitHub repository。
2. 在該 repository 啟用 GitHub Pages。
3. 如果你要用自訂網域，先在 GitHub Pages 設定裡填入 custom domain。
4. 把 DNS 指到 GitHub Pages。
5. 等 GitHub Pages 顯示自訂網域已啟用，而且 HTTPS 已經正常。
6. 確認這個網域也能用在你的 Google 廣告設定裡。
7. 部署前，記得把 `script.js` 裡的 `adUnitPath` 換成正式值。

## Google Ad Manager 檢查清單

1. 建立或選用一個 web rewarded ad 廣告單元。
2. 確認 `ad unit path` 填寫正確。
3. 確認這個 rewarded inventory 真的有需求來源或 line item 可以投放。
4. 請在最終的 HTTPS 網域上測試，不要只看 localhost。
5. 如果頁面沒出廣告，先判斷是不是 `no fill`，不一定是程式碼有問題。
6. 如果你提供的是一般 `display slot` 廣告單元，而不是 rewarded inventory，這個頁面的解鎖流程可能不會成功。

## 本機測試行為

- 在 `localhost` 上，頁面會自動使用開發模式，模擬 rewarded ad 流程。
- 如果 `adUnitPath` 仍然包含 `REPLACE_WITH_YOUR_NETWORK_CODE`，也會停留在開發模式。
- 部署到正式網域，而且填入真實 `adUnitPath` 後，頁面才會向 Google Ad Manager 請求真正的 rewarded ad。

## 檔案說明

- [index.html](./index.html)：頁面結構，以及 GPT script 載入位置
- [styles.css](./styles.css)：頁面樣式
- [script.js](./script.js)：rewarded ad 流程與答案解鎖邏輯

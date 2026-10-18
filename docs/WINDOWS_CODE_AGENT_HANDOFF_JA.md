# finance-simulation — Windowsコード担当への引き継ぎ

GitHub正本：`https://github.com/shihuiarenjinba-png/finance-simulation/tree/feature/fictional-finance-game-20261018`

このブランチを独立した作業フォルダへcloneし、Node.js 20以降で `npm test` と `index.html` のWindows 11/Edge手操作を実施。3種類の架空事業の配分、手数料、現金不足、24四半期の継続、保存/復元、破損セーブの保護、DPI100/125/150/200%、1366×768/1920×1080、キーボード操作を検証。

**実際の株価や投資APIに接続しないこと。リアルマネー、個人の金融データ、アカウント、銀行番号を要求しない。** 実際の利益保証や投資助言のように売り出さない。

正式Microsoft Storeのゲーム商品Identity/Publisherと商品名を取得できた段階で、別のWindows作業ブランチに安全なElectronホスト、正規MSIX、WACK、更新/アンインストール試験を実装。旧リリース・mainとセーブは保護する。

戻り情報：SHA、Node testログ/終了コード、Windows画面/保存結果、MSIXのIdentity/Publisher/Version/SHA256、WACK XML、残課題。正式に合格するまでStore審査提出禁止。

# 広告薬機法チェッカー TODO

## DB・バックエンド
- [x] DBスキーマ設計（checks, check_items テーブル）
- [x] pnpm db:push でマイグレーション実行
- [x] 画像アップロードAPI（S3 storagePut）
- [x] OCRテキスト抽出（LLM vision で画像→テキスト）
- [x] AI規制チェックロジック（薬機法・景品表示法・医療広告ガイドライン）
- [x] チェック結果保存API（tRPC mutation）
- [x] チェック履歴一覧取得API（tRPC query）
- [x] チェック詳細取得API（tRPC query）
- [x] チェック削除API（tRPC mutation）
- [x] Vitestテスト作成

## フロントエンド
- [x] グローバルスタイル・カラーパレット設定（index.css）
- [x] フォント設定（Google Fonts）
- [x] App.tsx ルーティング設定
- [x] ホームページ（ドラッグ&ドロップアップロードUI）
- [x] チェック結果ページ（違反カテゴリ別・リスクレベルバッジ・改善提案）
- [x] 履歴一覧ページ
- [x] ローディング・エラー状態の実装
- [x] レスポンシブデザイン対応

## 行政書士法チェック追加
- [x] 行政書士法の広告規制チェック項目を調査・整理
- [x] compliance.tsのAIプロンプトに行政書士法カテゴリ（gyoseishoshi）を追加
- [x] フロントエンドのカテゴリラベル・アイコン・カラーに行政書士法を追加
- [x] ホームページの「チェック対象の規制」カードに行政書士法を追加
- [x] Vitestテストに行政書士法違反ケースを追加

## ナレッジベース・精度表示セクション追加
- [x] ホームページ下部に参照法令・ガイドライン一覧セクションを追加
- [x] 各法令にリンク・条文番号・チェック内容の概要を記載
- [x] AIの限界・免責事項（法的アドバイスではない旨）を明示
- [x] チェック精度・対応範囲の説明を追加

## PDF出力機能
- [x] サーバーサイドPDF生成APIを実装（tRPC mutation: compliance.exportPdf）
- [x] チェック結果ページにPDFダウンロードボタンを追加
- [x] PDFレイアウト：ヘッダー（ロゴ・日時・ファイル名）、総合リスク、違反一覧（カテゴリ別）、改善提案、免責事項フッター

## バグ修正
- [x] OCR失敗：画像URLをLLM Visionに渡す際のエラーを修正（ストレージURLの形式問題）
- [x] PDFボタン非表示：ResultPageでdata未取得時にボタンが消える問題を修正

## OCR・PDFレイアウト修正
- [x] OCR失敗原因調査：storageGetSignedUrlのレスポンスをログ出力して問題を特定
- [x] OCR修正：署名付きURL取得失敗時のフォールバック処理を改善
- [x] PDFレイアウト全面改善：pdf-libで整ったレポートレイアウトを実装（ロゴ・セクション区切り・テーブル・カラーバー）

## OCRモデル変更（gemini-2.5-flashに変更）
- [x] claude-haiku-4-5がBedrock経由のdata URI base64画像を拒否する問題を特定
- [x] OCRモデルをgemini-2.5-flashに変更（data URI base64対応）
- [x] テスト7件全通過確認

## PDF出力方式の変更（window.print()）
- [x] ResultPage.tsxのexportPdf useMutationをhandlePrintPdf（window.print()）に変更
- [x] PDFボタンのonClickをhandlePrintPdfに変更
- [x] index.cssに@media print CSSを追加（A4サイズ・ナビ非表示・カラー印刷対応）
- [x] AppNav headerにno-printクラスを追加
- [x] ResultPage ボタン群のdivにno-printクラスを追加

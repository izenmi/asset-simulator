# asset-simulator - 資産形成＆FIRE詳細シミュレーター

## 概要
退職金・市場暴落ショック・サイドFIRE副収入・新NISA非課税枠と特定口座の税金分離・公的年金繰上げ/繰下げ・ライフイベント一時収支・モンテカルロ分析（確率分布・破綻率計算）まで完全網羅した高機能資産形成・FIREシミュレーションWebツール。
GitHub Pagesにて静的Webアプリとして公開。

- **GitHub Repository**: `https://github.com/izenmi/asset-simulator` (Public)
- **GitHub Pages URL**: `https://izenmi.github.io/asset-simulator/`

## 技術スタック
- ピュア HTML5 + Modern Vanilla JavaScript (ES6+)
- Tailwind CSS (Play CDN)
- Chart.js 4.4.4
- Lucide Icons
- 完全ローカル・ブラウザ完結（ビルドステップ不要、静的ファイル直配置でPages配信）

## ファイル構成
- `index.html`: メインUI（KPIカード、Standard/Advance切替フォーム、各種スライダー・数値入力、グラフ描画エリア、年別詳細テーブル、イベント追加モーダル、プラン保存・管理モーダル）
- `style.css`: カスタムスライダー、入力欄、テーブル、ダークモード、印刷用A4スタイル
- `app.js`: 状態管理、退職所得控除計算、年金調整率、暴落ショック回復モデル、モンテカルロ試行、Chart.js制御、CSV出力、URL共有、プラン保存・管理・JSONバックアップ復元
- `README.md`: プロジェクト説明、機能一覧、使い方

## Git・作者情報
- 作者情報: リポジトリローカルに設定（`izenmi@gmail.com` / `izenmi`）

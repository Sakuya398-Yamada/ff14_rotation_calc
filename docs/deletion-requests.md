# 削除の依頼を受けたとき

プライバシーポリシー（`/privacy`。#879）で、削除の依頼は Discord の DM（sakuyuno）で受けると書いている。この手順書は、依頼を受けたときに、本番の D1 から対象の行を探す手順をまとめる。行の消し方（SQL）は #920 で足す。

---

## 依頼の送り主のアカウントを探す

`user_identities.provider_user_id` には、生の Discord ID ではなく、Worker の secret `DISCORD_ID_HMAC_KEY` を鍵にした HMAC-SHA256 の hex が入っている（#918）。DM の送り主の ID から同じ値を手元で計算して探す。送り主の ID で探すのは、依頼した人がそのアカウントの持ち主だと確かめるため（本文に別の ID が書いてあっても、その ID では探さない）。

準備: パスワードマネージャーなどに控えた `DISCORD_ID_HMAC_KEY` の値（`CONTRIBUTING.md`「Discord のユーザー ID の HMAC の鍵（初回のみ）」）。Worker の secret は後から読み出せないので、控えが無いと探せない。

1. 送り主の Discord ID をコピーする。Discord の **ユーザー設定** → **詳細設定** で **開発者モード** をオンにし、DM の送り主のアイコンか名前を右クリックして **ユーザー ID をコピー** を選ぶ（スマートフォンは長押し）
2. リポジトリ直下で、ID から値を計算する。鍵を聞かれたら、控えた値を貼り付けて Enter を押す（鍵を引数にしないのは、コマンドの履歴に残さないため）。64 文字の hex が出る

   ```bash
   node scripts/discord-id-hmac.mjs <送り主の ID>
   ```

3. その値で本番の D1 を探す。1 行出たら、その `user_id`（`users.id`）が依頼したアカウント

   ```bash
   npx wrangler d1 execute DB --remote --command "SELECT user_id FROM user_identities WHERE provider = 'discord' AND provider_user_id = '<手順 2 の値>';"
   ```

### 見つからないとき

- その Discord アカウントでログインしたことが無い。匿名で保存したタイムラインの削除なら、共有 URL を聞いて探す（#920）
- 鍵を作り直す（失う）前にしかログインしていない。前の鍵で作った値は、今の鍵では計算できないので探せない。その旨を依頼の送り主に伝える（前の鍵の行は、鍵が無いと誰のものか分からない値として残っている）
- 手順 2 で貼った鍵が違う（前後に別の文字が入った、別の値を控えていた）。`npx wrangler secret list` で `DISCORD_ID_HMAC_KEY` が入っていることは確かめられるが、値は読み出せない

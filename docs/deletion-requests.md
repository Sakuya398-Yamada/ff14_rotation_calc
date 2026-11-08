# 削除の依頼を受けたとき

プライバシーポリシー（`/privacy`。#879）で、削除の依頼は Discord の DM（sakuyuno）で受けると書いている。この手順書は、依頼を受けたときに、本番の D1 から対象の行を探して消す手順をまとめる。ポリシーで約束した消し方は次の 2 つ。

| 依頼 | 消すもの | 本人の確かめ方 |
|---|---|---|
| アカウントの情報 | 送り主のアカウントの `users`・`user_identities`・`user_owners`・`sessions` の行。依頼に書いてあれば、アカウントに紐づくタイムラインも | DM の送り主の Discord ID で探す（[依頼の送り主のアカウントを探す](#依頼の送り主のアカウントを探す)） |
| ログインせずに保存したタイムライン | 共有 URL のタイムライン。削除済みのものだけ | アプリで削除済みであること（削除できるのは持ち主だけ） |

ほかの人が複製して保存したタイムライン（`parent_id` が消すタイムラインを指す行）は、その人の保存なので消さない。

コマンドはどれもリポジトリ直下で打つ。`<user_id>` などのプレースホルダーは、引用符を残したまま中身だけを置き換える。

消し終えたら、送り主に DM で消したことを伝える。この DM の日時が、消した日時の記録になる（[バックアップと Time Travel に残る分](#バックアップと-time-travel-に残る分)）。

---

## タイムラインの消し方（行を残して中身を空にする）

タイムラインは行を DELETE せず、中身の列を空にした行を残す。

- 複製の子があると、子の `parent_id` が外部キーで指しているので、親の行は DELETE できない（`FOREIGN KEY constraint failed`）
- 行が残るので、共有 URL は削除したときと同じ「削除済み」の表示のまま（行が無いと「見つからない」になる）。その URL を開いたままの人が複製を保存しても、保存は `parent_not_found` で失敗しない

空にしたあとに残るのは、`id`・`schema_ver`・`created_at`・`deleted_at` だけ。内容（`data`・`title`・`content_id`・`job`・`level`）に加え、同じブラウザのほかの保存とのつながり（`owner_hash`）と複製元（`parent_id`）も消す。`schema.ts` のコメントにある「UPDATE するのは deleted_at だけ」の例外はこの手作業だけ。

どの SQL も、もう一度流しても結果は変わらない。途中で失敗したら、同じコマンドをもう一度流す。

---

## ログインせずに保存したタイムラインを消す

1. 依頼に添えられた共有 URL の `/t/` の後ろ（英語版は `/en/t/` の後ろ）の 21 文字を ID として控える
2. 削除済みかを確かめる。`deleted_at` に値があれば削除済み

   ```bash
   npx wrangler d1 execute DB --remote --command "SELECT id, deleted_at FROM timelines WHERE id = '<ID>';"
   ```

   - 行が出ない: URL の写し間違い。送り主に URL を確かめる
   - `deleted_at` が `null`: まだ削除されていない。消さずに、先にこのツールの「保存したタイムライン」から削除してもらう（削除できるのは持ち主だけなので、持ち主であることの確認になる）
3. 中身を空にする。`deleted_at IS NOT NULL` を条件に入れ、削除されていない行には効かないようにする

   ```bash
   npx wrangler d1 execute DB --remote --command "UPDATE timelines SET data = '{}', title = NULL, content_id = NULL, parent_id = NULL, job = '', level = 0, owner_hash = '' WHERE id = '<ID>' AND deleted_at IS NOT NULL;"
   ```

4. 空になったことを確かめる。`data` が `{}`、`job` と `owner_hash` が空、`title`・`content_id`・`parent_id` が `null` になっていればよい

   ```bash
   npx wrangler d1 execute DB --remote --command "SELECT id, data, title, content_id, parent_id, job, level, owner_hash, deleted_at FROM timelines WHERE id = '<ID>';"
   ```

---

## アカウントを消す

1. [依頼の送り主のアカウントを探す](#依頼の送り主のアカウントを探す)で `user_id` を出す
2. **アカウントに紐づくタイムラインも消す依頼のときだけ**、ここで消す。紐づきは `user_owners` でたどるので、手順 3 で `user_owners` を消す前に行う。まだ削除されていないものも消すので、`deleted_at` も付ける

   ```bash
   npx wrangler d1 execute DB --remote --command "UPDATE timelines SET data = '{}', title = NULL, content_id = NULL, parent_id = NULL, job = '', level = 0, owner_hash = '', deleted_at = COALESCE(deleted_at, unixepoch()) WHERE owner_hash IN (SELECT owner_hash FROM user_owners WHERE user_id = '<user_id>');"
   ```

   残っていないことを確かめる。`count` が 0 ならよい

   ```bash
   npx wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS count FROM timelines WHERE owner_hash IN (SELECT owner_hash FROM user_owners WHERE user_id = '<user_id>');"
   ```

   タイムラインを消す依頼でなければ、この手順は飛ばす。タイムラインはそのまま残り、共有 URL で今までどおり開ける
3. アカウントの行を消す。`users` を参照する行が先に消えるよう、この順に流す

   ```bash
   npx wrangler d1 execute DB --remote --command "DELETE FROM sessions WHERE user_id = '<user_id>'; DELETE FROM user_owners WHERE user_id = '<user_id>'; DELETE FROM user_identities WHERE user_id = '<user_id>'; DELETE FROM users WHERE id = '<user_id>';"
   ```

4. 消えたことを確かめる。4 つとも 0 ならよい

   ```bash
   npx wrangler d1 execute DB --remote --command "SELECT (SELECT COUNT(*) FROM users WHERE id = '<user_id>') AS users, (SELECT COUNT(*) FROM user_identities WHERE user_id = '<user_id>') AS identities, (SELECT COUNT(*) FROM user_owners WHERE user_id = '<user_id>') AS owners, (SELECT COUNT(*) FROM sessions WHERE user_id = '<user_id>') AS sessions;"
   ```

送り主が同じ Discord アカウントでまたログインすると、別のユーザーとして新しく作られる。

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

- その Discord アカウントでログインしたことが無い。匿名で保存したタイムラインの削除なら、共有 URL を聞いて[ログインせずに保存したタイムラインを消す](#ログインせずに保存したタイムラインを消す)の手順で消す
- 鍵を作り直す（失う）前にしかログインしていない。前の鍵で作った値は、今の鍵では計算できないので探せない。その旨を依頼の送り主に伝える（前の鍵の行は、鍵が無いと誰のものか分からない値として残っている）
- 手順 2 で貼った鍵が違う（前後に別の文字が入った、別の値を控えていた）。`npx wrangler secret list` で `DISCORD_ID_HMAC_KEY` が入っていることは確かめられるが、値は読み出せない

---

## バックアップと Time Travel に残る分

消した中身は、D1 の Time Travel（Free は 7 日）と、自宅サーバーのバックアップ（30 世代。`docs/d1-backup.md`）にしばらく残る。どちらも書き換えず、期間が過ぎて自然に消えるのを待つ（ポリシーの「消したデータも、ふつうは 30 日ほどでバックアップから消えます」）。

バックアップや Time Travel で本番を戻すと、戻した時点より後に消した中身も戻る。戻したら、その時点より後に消した依頼を、この手順でもう一度消す。どれが当たるかは、依頼を受けた日時ではなく、消したことを伝えた DM の日時で選ぶ（前日に受けて、バックアップを取ったあとに消した依頼も戻っている）。

# テスト規約（既知の罠と回避パターン）

このファイルは CLAUDE.md から `@.claude/rules/testing-conventions.md` でインポートされる。
`resolve-timeline.ts` 周辺のテスト記述時に繰り返し踏みやすい罠と、その標準回避パターンをまとめる（導入Issue: #289、発生元: #198 / #217）。

## 罠1: `resolveTimeline` の `activeBuffs` は要素オブジェクトを参照共有する

### 何が起きるか

`resolve-timeline.ts` の各エントリ snapshot は `activeBuffs: [...currentActiveBuffs]` による **shallow copy** で作られる（`src/client/logic/resolve-timeline.ts` 内の snapshot 生成箇所を参照）。配列自体は複製されるが、`ActiveBuff` 要素オブジェクトはエントリ間で参照を共有する。

後続エントリの処理で `ab.stacks = Math.max(0, ab.stacks - 1)` のように要素を mutate すると、**過去エントリの snapshot 内の `stacks` も最終値に書き換わる**。

### テストでの回避パターン

- **過去エントリの `stacks` 等の数値比較を書かない**。以下は期待値と乖離して失敗する：

  ```ts
  // NG: entries[0] の stacks は後続処理で書き換わっている可能性がある
  expect(result.entries[0].activeBuffs.find((ab) => ab.buffId === "xxx")?.stacks).toBe(2);
  ```

- **段階消費は配列への含有／除外（`some(...)`）で検証する**。バフが完全消費されると `currentActiveBuffs` から要素が取り除かれるため、各エントリの snapshot に「入っているか／いないか」は信頼できる：

  ```ts
  // OK: エントリごとのバフの有無で段階消費を検証する
  expect(result.entries[0].activeBuffs.some((ab) => ab.buffId === "xxx")).toBe(true);
  expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "xxx")).toBe(false);
  ```

- 数値そのものを検証したい場合は、**最終エントリ時点の値**か、`resourceSnapshot` のようにエントリ毎に値がコピーされるフィールドを使う

> コード側を deep copy 化するリファクタ（snapshot の純度を上げる案）は本規約のスコープ外。必要になったら別Issueとして起票する。

## 罠2: リソース回復量テストの上限キャップ

### 何が起きるか

MP 等のリソースは定義上の上限（MP は 10000）にキャップされる。リソースが満タンの初期状態から回復スキルを撃っても **差分が +0 になり、回復量の assertion が失敗する**。

既存テストの describe ブロック内コメント（`src/client/logic/__tests__/blm-af-ub.test.ts` の「BLM: UB 段階別 MP 回復」冒頭）に注意書きがあるが、別の describe ブロックから類似テストを書くと見落としやすい。

### テストでの回避パターン

回復量を観測するテストでは、**事前にリソースを消費するシーケンスを挟んでから測定する**。BLM の MP の標準パターン：

```
fire-3（AF3 で MP -2000）→ despair（MP 全消費）→ transpose（AF→UB1）→ 測定対象スキル
```

```ts
// before < 10000 を確認してから回復を観測する
const before = result.entries[N].resourceSnapshot["mp"];
const after = result.entries[N + 1].resourceSnapshot["mp"];
expect(before).toBeLessThan(10000);
expect(after).toBe(/* 期待値。上限到達なら 10000 */);
```

ポイント:

- **`before` が上限未満であることを assert に含める**。事前消費が効いていないケース（シーケンス誤り）を検出できる
- 上限到達を期待する場合も「キャップされた結果 10000」であることをコメントで明示する
- 他ジョブでも上限付きリソース（ゲージ類）の回復・蓄積量を観測する場合は同じ構造（事前消費 → before/after 比較）を踏襲する

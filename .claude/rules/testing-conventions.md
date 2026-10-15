# テスト規約（既知の罠と回避パターン）

`.claude/rules/` 配下のため起動時に自動で読み込まれる。
`resolve-timeline.ts` 周辺のテスト記述時に繰り返し踏みやすい罠と、その標準回避パターンをまとめる（導入Issue: #289 / #389 / #433 / #429、発生元: #198 / #217 / #351 / #410 / #412）。

## 罠1: `activeBuffs` の `stacks` は #429 より前は後続処理で書き換わっていた（解消済み）

`resolveTimeline` の各エントリの `activeBuffs` は、#429 から要素ごとに複製したスナップショットになった（`activeBuffsAtUse` と同じ）。過去エントリの `stacks` も、そのエントリ時点の値として比較してよい（例: `src/client/logic/__tests__/buff-stack-snapshot.test.ts`）。

既存テストに残る「段階消費を `some(...)` の有無だけで検証する」書き方は、この不具合を避けるためのもの。新しく書くテストで真似る必要はない。

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

## 罠3: エラーのあるエントリは倍率が 1・CRT/DH ボーナスが 0 になる

### 何が起きるか

`resolveTimeline` は、ハードエラーのあるエントリ（`recastError` / `untargetableError` が true、`comboErrors` / `resourceErrors` が空でない）を「実行されなかった」扱いにし、`buffMultiplier` を 1、`critRateBonus` / `dhRateBonus` を 0 に倒す（`src/client/logic/resolve-timeline.ts` の `hasError` 判定と `buffMultiplierBeforeApply = hasError ? 1 : ...`）。期待威力も 0 になる（`expected-potency.ts`）。これはアプリの仕様として正しい。`wsComboError` はハードエラーではないので対象外。

ただしテストで「倍率が 1 になる＝バフが乗っていない／切れている」と検証すると、**エラーで 1 に倒れているだけでも通ってしまい、assertion が意味を失う**。#351 ではランスチャージの失効境界を確かめるため 19.9 秒と 20 秒の GCD を同じタイムラインに置いた結果、20 秒側が `recastError` になり、`expireBuffs` の境界条件 `<=` を `<` に変えてもテストが通ってしまった。

### テストでの回避パターン

- **倍率 1／ボーナス 0 を検証するときは、同じエントリにエラーが無いことも assert する**：

  ```ts
  // NG: recastError で 1 に倒れていても通る
  expect(entry.buffMultiplier).toBe(1);

  // OK: エラーが無いことを確かめてから倍率を検証する
  expect(entry.recastError).toBeFalsy();
  expect(entry.untargetableError).toBeFalsy();
  expect(entry.comboErrors).toEqual([]);
  expect(entry.resourceErrors).toEqual([]);
  expect(entry.buffMultiplier).toBe(1);
  ```

- **`manualStartTime` で GCD を GCD 間隔より詰めて置かない**。境界の前後など複数の時刻を確かめたいときは、時刻ごとに別のタイムラインで解決する（例: `src/client/logic/__tests__/drg-resources.test.ts` の「付与から %s 秒後のスキルの倍率は %s」。`it.each` で時刻を回し、各ケースで `resolveTimeline` を呼び直している）

## 罠4: レベル別の実データテストで skillMap を `getSkillsForLevel` の結果だけで作るとスキルが欠ける

### 何が起きるか

`getSkillsForLevel` が返すのは **パレットに並べるスキル** で、次の 2 種類は含まれない：

- **autoTransform の変化先**（雲蒸竜変・竜眼雷電など、パレットに出さず変化元から自動で切り替わるスキル）
- **上位版の習得で置き換えられたスキル**（`replacesSkillId` の置き換え元。Lv96 以降のボーパルスラスト → スラストラッシュ等。習得済みだがパレットからは外れる）

アプリ本体はこれらを足した全スキルマップ（`src/client/components/App.tsx` の `allSkillMap`）で `resolveTimeline` を呼んでいる。テストで `getSkillsForLevel` の結果だけを skillMap にすると、該当エントリが解決から消える／自動変化しないといった、アプリでは起きない症状になる。#412 では原因の特定に数往復かかった。

### テストでの回避パターン

- **`App.tsx` の `allSkillMap` と同じく、`getSkillsForLevel` → `getAllSkillMapForLevel`（`src/client/logic/skill-level.ts`）の順で skillMap を作る**。`getAllSkillMapForLevel` は、パレットから外れたスキルにも同じレベル調整（`adjustSkillForLevel`）をかけて足す：

  ```ts
  const buffs = getBuffsForLevel(XXX_BUFFS, level);
  const resources = getResourcesForLevel(XXX_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(XXX_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(XXX_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  resolveTimeline(entries, skillMap, resources, undefined, buffs);
  ```

- 参考実装: `src/client/logic/__tests__/pct-jobguide-sync.test.ts` の `setup`
- `src/client/logic/__tests__/drg-job-guide-7-5.test.ts` の `resolveAtLevel` も同じ目的のヘルパーだが、`getAllSkillMapForLevel` ができる前（#412）に書かれたもので、ループを手書きしている。足したスキルにはレベル調整がかからないので、新しく書くテストではこちらを真似ない

## 罠5: データ値を見るテストは、エンジンがその値を使っていることまでは保証しない

### 何が起きるか

`skillMap.get(id)?.recastTime` のようにデータの値を直接見るテストは、データが正しいことしか確かめていない。`resolveTimeline` がその値を実際に参照しているかは別の話になる。

#410 では、サブトラクティブ色魔法のリキャストを 3.3 秒に直し、スキルマップの `recastTime` を見るテストも通った。しかし `resolveTimeline` は GCD のリキャスト・詠唱を、autoTransform を解決する前の **変化元スキル** から読んでいたため、タイムライン上の間隔は変わっていなかった。ブラウザで確認するまで気付けなかった。

### テストでの回避パターン

- **データ修正の Issue では、少なくとも 1 項目を `resolveTimeline` の結果で検証する**。エントリ間隔（`startTime` の差）・`castTime`・`resolvedPotency`・`resourceSnapshot` など、アプリの表示に直結する値を見る
- **autoTransform の変化先の値は特に注意する**。変化先は変化元の経路を通って解決されるため、データだけ見るテストでは取りこぼしやすい。`resolvedSkillId` で変化先に切り替わったことも併せて確かめる：

  ```ts
  // これだけでは不十分: データの値しか見ていない
  expect(skillMap.get("blizzard-in-cyan")?.recastTime).toBe(3.3);

  // OK: タイムライン上で変化先に切り替わり、その値で間隔が決まっていることを見る
  expect(cyan.resolvedSkillId).toBe("blizzard-in-cyan");
  expect(Math.round((yellow.startTime - cyan.startTime) * 1000) / 1000).toBe(3.3);
  ```

- 参考実装: `src/client/logic/__tests__/pct-jobguide-sync.test.ts` の「タイムライン上でもサブトラクティブ色魔法・ブラックコメットは詠唱 2.3 秒・リキャスト 3.3 秒になる」
- skillMap の組み方は罠4 に従う（組み方が違うと、アプリでは起きない差分が出る）

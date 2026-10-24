---
paths:
  - ".claude/agents/*.md"
  - ".claude/skills/issue-plan/SKILL.md"
---

# モデルと effort の割り当て

frontmatter の `paths:` により、`.claude/agents/*.md` と `.claude/skills/issue-plan/SKILL.md` を Read / Edit / Write したときだけ読み込まれる。モデルや effort を変えるとき・新しいモデルに移るときの判断材料。割り当ての理由と出典の正本は #495 の[割り当て表のコメント](https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues/495#issuecomment-6381308423)。

## 今の割り当て（#495、2026-10）

| 対象 | model | effort | 置き場所 |
|------|-------|--------|---------|
| `/issue-plan` | `claude-fable-5-1` | `high` | SKILL.md の frontmatter |
| `/issue-start` のメインセッション | Opus 5.5 | `high` | セッション側（`/model`・`/effort`）。frontmatter には書かない |
| `code-explorer` / `code-reviewer` | `claude-opus-5-5` | `high` | agents の frontmatter |
| `code-architect` | `claude-opus-5-5` | `xhigh` | agents の frontmatter |

## 書き方

- model はエイリアス（`opus` 等）ではなく完全なモデル ID で書く。effort の目盛りはモデルごとに較正されているので、エイリアスの指す先が黙って変わると model と effort の組み合わせがずれる。新しいモデルに移るときは、この表と frontmatter を同じ PR で書き換える
- effort も明示する。書かないとセッションの effort を引き継ぐ（#495 のクラウドセッションでは xhigh で動いていた）
- skill の `model` / `effort` は、その skill を呼んだターンの残りにだけ効き、次にユーザーがメッセージを送ると戻る。モデルを切り替えたターンは会話全体をキャッシュ無しで読み直す（effort の変更は 5.5 世代と Fable 5.1 ならキャッシュを保つ）。何ターンも続く skill（`/issue-start` はユーザーの返信や PR のイベントで続く）には書かず、AskUserQuestion で 1 ターンに収まる skill（`/issue-plan`）にだけ書く
- 無人ルーティン（`.claude/routines/`）は SKILL.md をファイルとして読み、Skill ツールで呼ばないので、skill の frontmatter はルーティンに効かない。agents の frontmatter は効く
- Fable は Max プランでは週の利用枠の 50% までの別上限があり、ほかのモデルより早く枠を減らす。無人で回る経路（ルーティンから起動するサブエージェントなど）には割り当てない

## 変えたときの検証

- 実際に動いた model / effort は、サブエージェントの transcript（`~/.claude/projects/<プロジェクト>/<セッション>/subagents/agent-<agentId>.jsonl`。agentId は Agent ツールの結果に出る）で確かめる。クラウドセッションでは `/tasks` が使えない

  ```bash
  jq -c 'select(.type=="assistant") | {model: .message.model, requestedModel, effort}' <file> | sort | uniq -c
  ```

- 作業中のセッションでは `.claude/agents/` の変更が読み込まれないことがある（#495 のクラウドセッションでは、新しく置いたエージェントも `Agent type '...' not found` になった）。model はエイリアスと完全な ID が同じモデルに解決されると区別できないので、effort がセッションの値のままなら、push してから PR ブランチで立てた新しいセッションで確かめる（`phases/05-implementation.md`「起動時に読まれる設定の検証」）
- skill の `model` は、クラウドセッションで Claude が Skill ツールから呼んだ経路では効かなかった（#495。effort は効いた）。ユーザーが `/issue-plan` と打ったときに効くかは未確認なので、確かめたらここを更新する

#!/usr/bin/env node
// Detection logic for the validate-edit-path PreToolUse hook.
// Invoked by validate-edit-path.sh, which gathers the worktree list via git
// and forwards it through env vars so this script stays free of git/IO concerns
// (and is easy to test by overriding the env vars directly).
//
// Inputs:
//   stdin                       Claude Code hook JSON payload
//   env CLAUDE_HOOK_PROJ_DIR    project dir from CLAUDE_PROJECT_DIR (or pwd fallback)
//   env CLAUDE_HOOK_WT_LIST     newline-joined worktree paths from `git worktree list --porcelain`
//                               (first line = main repo, remainder = registered worktrees)
//   env CLAUDE_ALLOW_MAIN_REPO_EDIT  '1' to opt out (warning suppressed)
//
// Exit codes:
//   0 = OK / opt-out / out of scope
//   1 = warning emitted to stderr (does NOT block the tool; user-facing)
//
// Audience: Claude Code's hook protocol only forwards stderr to the assistant
// when exit code is 2 (block). Exit 1 surfaces the warning to the human
// operator's terminal only — the assistant itself does NOT see it. This is
// deliberate per Issue #246 ("警告のみ、ブロックしない"): the human notices
// and intervenes; the assistant will continue thinking the Edit succeeded.
// Switch to exit 2 if/when blocking-with-retry is preferred.

'use strict';

const fs = require('fs');

function normalize(p) {
  if (!p) return '';
  let q = p.replace(/\\/g, '/').replace(/\/+$/, '');
  // MSYS-style "/d/foo" -> "d:/foo"
  q = q.replace(/^\/([a-zA-Z])(\/|$)/, (_, drive, rest) => drive.toLowerCase() + ':' + rest);
  return q;
}

function ci(s) {
  return s.toLowerCase();
}

function main() {
  if (process.env.CLAUDE_ALLOW_MAIN_REPO_EDIT === '1') {
    process.exit(0);
  }

  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = payload && payload.tool_name;
  const filePath = payload && payload.tool_input && payload.tool_input.file_path;
  if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);
  if (!filePath || typeof filePath !== 'string') process.exit(0);

  const projDir = process.env.CLAUDE_HOOK_PROJ_DIR || process.cwd();
  const wtListRaw = process.env.CLAUDE_HOOK_WT_LIST || '';
  const wtList = wtListRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  if (wtList.length === 0) process.exit(0);

  const mainRepo = wtList[0];
  const worktrees = wtList.slice(1);

  const nProj = ci(normalize(projDir));
  const nMain = ci(normalize(mainRepo));

  // Find the current worktree (must NOT be the main repo).
  let currentWt = null;
  for (const wt of worktrees) {
    if (ci(normalize(wt)) === nProj) {
      currentWt = wt;
      break;
    }
  }
  if (!currentWt) process.exit(0); // working in main repo or non-worktree context

  const nCurWt = ci(normalize(currentWt));
  const nFile = ci(normalize(filePath));

  // file_path under the current worktree → correct usage.
  if (nFile === nCurWt || nFile.startsWith(nCurWt + '/')) process.exit(0);

  // file_path NOT under main repo prefix → out of scope (different drive, /tmp, etc.).
  if (nFile !== nMain && !nFile.startsWith(nMain + '/')) process.exit(0);

  // Compute relative path from main repo (case-insensitive prefix match).
  const relFromMain = nFile === nMain ? '' : nFile.slice(nMain.length + 1);
  if (!relFromMain) process.exit(0); // file_path == main repo root, ignore

  // file_path inside another registered worktree (.claude/worktrees/<other>/) → out of scope.
  if (relFromMain.startsWith('.claude/worktrees/')) process.exit(0);

  // Build candidate path inside the current worktree using ORIGINAL casing of the relative part.
  const origNormFile = normalize(filePath);
  const origNormMain = normalize(mainRepo);
  const prefixLen =
    ci(origNormFile) === ci(origNormMain) ? origNormFile.length : origNormMain.length + 1;
  const relPath = origNormFile.slice(prefixLen);
  const candidate = normalize(currentWt) + (relPath ? '/' + relPath : '');

  // Final condition: corresponding file/dir must exist in the worktree to count as a likely mistake.
  let exists = false;
  try {
    fs.accessSync(candidate);
    exists = true;
  } catch {
    /* ignore */
  }
  if (!exists) process.exit(0); // intentional main-only edit (e.g. shared file absent in worktree)

  const lines = [
    '[hook:validate-edit-path] WARNING: file_path points to the MAIN REPO while you are working in a registered worktree.',
    '',
    '  Tool:      ' + toolName,
    '  file_path: ' + filePath,
    '  Worktree:  ' + currentWt,
    '  Hint:      ' + candidate,
    '',
    'The Edit/Write will succeed against the main repo, but subsequent bash commands run against the',
    'worktree (CLAUDE_PROJECT_DIR: ' + projDir + '). This silent path-mismatch caused the bug in PR #241',
    '/ Issue #243.',
    '',
    'NOTE: this warning is for the human operator — Claude Code does not forward exit-1 stderr',
    'to the assistant, so the assistant will continue thinking the Edit succeeded. If you (human)',
    'see this and the path is wrong, interrupt and have the assistant retry with the worktree path.',
    '',
    'If this is intentional (e.g. updating shared settings from a worktree), set',
    'CLAUDE_ALLOW_MAIN_REPO_EDIT=1 to suppress this warning.',
    '',
  ];
  process.stderr.write(lines.join('\n'));
  process.exit(1);
}

main();

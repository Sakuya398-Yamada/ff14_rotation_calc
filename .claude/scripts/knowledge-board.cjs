#!/usr/bin/env node
// Reads the workflow knowledge board issue (#195) without dumping every comment
// into the conversation. Fetching it with the GitHub MCP `issue_read` pulls all
// comments plus user/URL metadata into context; this script keeps the raw JSON
// in a temp file and prints only what was asked for.
//
// Usage:
//   node .claude/scripts/knowledge-board.cjs open            unresolved insights, one line each
//   node .claude/scripts/knowledge-board.cjs grep <pattern>  matching lines only (case-insensitive regex)
//   node .claude/scripts/knowledge-board.cjs show <id>       full body of one comment
//   Add --cached to reuse the last fetched JSON instead of calling `gh api` again.

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BOARD_ISSUE = 195;
const CACHE_FILE = path.join(os.tmpdir(), `knowledge-board-${BOARD_ISSUE}.json`);
const GH_FALLBACK = 'C:\\Program Files\\GitHub CLI\\gh.exe';
// Two marker forms: promoted to an issue here (`✅ Issue #433 で対応`) and
// resolved upstream then pulled in by a template update (`✅ Issue owner/repo#17 で対応（…）`).
const RESOLVED_MARKER = /✅ Issue (\S+\/\S+)?#\d+/;

function runGh(args) {
  const opts = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  for (const bin of ['gh', GH_FALLBACK]) {
    try {
      return execFileSync(bin, args, opts);
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      // gh has already written its own error to stderr.
      fail(`gh api failed (exit ${e.status})`);
    }
  }
  fail('gh not found; install GitHub CLI or add it to PATH');
}

function loadComments(cached) {
  if (cached) {
    if (!fs.existsSync(CACHE_FILE)) fail(`no cached data at ${CACHE_FILE}; run without --cached first`);
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
  // `{owner}/{repo}` is filled in by gh from the current repository's remote.
  const json = runGh(['api', '--paginate', `repos/{owner}/{repo}/issues/${BOARD_ISSUE}/comments?per_page=100`]);
  const comments = JSON.parse(json);
  fs.writeFileSync(CACHE_FILE, json);
  return comments;
}

function fail(msg) {
  process.stderr.write(`knowledge-board: ${msg}\n`);
  process.exit(1);
}

function lines(body) {
  return body.split(/\r?\n/);
}

function field(body, name) {
  const ls = lines(body);
  const i = ls.findIndex((l) => l.startsWith(`**${name}**`));
  if (i === -1) return '';
  const inline = ls[i].replace(/^\*\*[^*]+\*\*[:：]?\s*/, '').trim();
  if (inline) return inline;
  return (ls.slice(i + 1).find((l) => l.trim()) || '').trim();
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function summarize(c) {
  const heading = lines(c.body).find((l) => l.startsWith('## ')) || '';
  const work = (heading.match(/\[(#\d+)\]/) || [])[1] || '-';
  const importance = field(c.body, '重要度').replace(/~~[^~]*~~\s*→?\s*/g, '').split(/[（(]/)[0].trim() || '-';
  const upstream = field(c.body, '還元先').replace(/（↗ 還元済み:[^）]*）/, '（還元済み）') || '-';
  return {
    id: c.id,
    date: c.created_at.slice(0, 10),
    work,
    importance,
    upstream,
    resolved: RESOLVED_MARKER.test(c.body),
    insight: field(c.body, '気づき'),
  };
}

function cmdOpen(comments) {
  const open = comments.map(summarize).filter((s) => !s.resolved);
  for (const s of open) {
    console.log([s.id, s.date, `[${s.work}]`, s.importance, s.upstream, truncate(s.insight, 60)].join('  '));
  }
  console.log(`未回収: ${open.length} 件 / 全 ${comments.length} 件`);
}

function cmdGrep(comments, pattern) {
  if (!pattern) fail('usage: grep <pattern>');
  let re;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const MAX_LINES = 5;
  let hits = 0;
  for (const c of comments) {
    const matched = lines(c.body)
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l }) => re.test(l));
    if (matched.length === 0) continue;
    hits++;
    const s = summarize(c);
    console.log(`${s.id}  ${s.date}  [${s.work}]  ${s.resolved ? '回収済み' : '未回収'}`);
    for (const { l, n } of matched.slice(0, MAX_LINES)) console.log(`  L${n}: ${truncate(l.trim(), 160)}`);
    if (matched.length > MAX_LINES) console.log(`  …他 ${matched.length - MAX_LINES} 行`);
  }
  console.log(`該当: ${hits} 件 / 全 ${comments.length} 件`);
}

function cmdShow(comments, id) {
  if (!id) fail('usage: show <id>');
  const c = comments.find((x) => String(x.id) === id);
  if (!c) fail(`comment ${id} not found`);
  console.log(`# ${c.html_url} (${c.created_at.slice(0, 10)})\n`);
  console.log(c.body.replace(/\r\n/g, '\n'));
}

const args = process.argv.slice(2);
const cached = args.includes('--cached');
const [cmd, arg] = args.filter((a) => a !== '--cached');
const commands = { open: cmdOpen, grep: cmdGrep, show: cmdShow };
if (!commands[cmd]) fail('usage: knowledge-board.cjs <open|grep <pattern>|show <id>> [--cached]');
commands[cmd](loadComments(cached), arg);

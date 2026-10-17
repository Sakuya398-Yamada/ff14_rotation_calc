#!/usr/bin/env python3
"""Resident-context budget: the always-loaded instruction files must stay under a line budget.

Usage: .claude/scripts/check-context-budget.py [--limit N] [repo-root]

Why: CLAUDE.md and every `.claude/rules/*.md` without a `paths:` frontmatter are loaded into
every Claude Code session (Copilot equivalents: copilot-instructions.md and every instructions
file whose `applyTo` is "**"). Each PR adds only a few lines, so the growth is invisible in
review until instruction adherence drops. This check turns the total into a number that CI
refuses to let drift past the budget. Raising a budget is a deliberate decision: change the
constant below and say why in the commit message (.claude/rules/documentation-policy.md).
Copied from the template repository's tests/check-context-budget.py (issue-driven-dev-starter
v2.1.3) with BUDGETS pointed at this repository and the limit raised to the 1000 lines that
projects aim for (its docs/customization.md "コンテキスト予算の点検").

Counting: lines of each resident file, excluding a YAML frontmatter block (`---` ... `---` at
the top) so the Copilot files are not penalised for their mandatory `applyTo` header. A rules /
instructions file is resident when it has no frontmatter, or its frontmatter has no `paths:`
(Claude Code) / has `applyTo: "**"` or no `applyTo` (Copilot). Scoped files load on demand and
are listed but not counted.

`--limit N` overrides every budget; use it to see the check fail on purpose
(`.claude/scripts/check-context-budget.py --limit 100` must exit 1).
"""
import argparse
import glob
import os
import re
import sys

BUDGETS = {
    "project (Claude Code)": {
        "limit": 1000,
        "index": "CLAUDE.md",
        "rules_glob": ".claude/rules/**/*.md",
        "scope_key": "paths",  # present in frontmatter -> loads on demand
    },
}


def split_frontmatter(lines):
    """Return (frontmatter_lines, body_lines). No closing '---' means no frontmatter."""
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() == "---":
                return lines[1:j], lines[j + 1:]
    return [], lines


def is_resident(frontmatter, scope_key):
    for line in frontmatter:
        m = re.match(rf"^{re.escape(scope_key)}\s*:\s*(.*)$", line)
        if not m:
            continue
        if scope_key == "applyTo":
            value = m.group(1).strip().strip("\"'")
            return value in ("**", "")
        return False  # a `paths:` key makes a Claude Code rule path-scoped
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, help="override every budget (for testing the failure path)")
    ap.add_argument("root", nargs="?", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    args = ap.parse_args()
    os.chdir(args.root)

    failed = False
    for name, budget in BUDGETS.items():
        limit = args.limit if args.limit is not None else budget["limit"]
        files = [budget["index"]] + sorted(glob.glob(budget["rules_glob"], recursive=True))
        total = 0
        rows = []
        for path in files:
            if not os.path.isfile(path):
                rows.append(("MISSING", path))
                failed = True
                continue
            with open(path, encoding="utf-8") as fh:
                lines = fh.read().splitlines()
            frontmatter, body = split_frontmatter(lines)
            if path != budget["index"] and not is_resident(frontmatter, budget["scope_key"]):
                rows.append(("on demand", path))
                continue
            total += len(body)
            rows.append((f"{len(body):4d}", path))
        status = "OK" if total <= limit else "OVER BUDGET"
        print(f"{name}: {total} / {limit} resident lines ... {status}")
        for count, path in rows:
            print(f"  {count:>9}  {path}")
        if total > limit:
            failed = True

    print("check-context-budget: " + ("FAIL" if failed else "OK"))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

# FFXIV Rotation Calculator

[日本語](./README.md)

A **web tool that automatically calculates the expected potency and PPS (potency per second)** of rotations in FFXIV (Final Fantasy XIV).

Just place actions on the timeline, and the expected values, with buffs, DoTs and recasts taken into account, are calculated in real time.

---

## Features

- **Automatically calculates expected potency and PPS** from the actions you place on a timeline
- Calculates expected damage with stacked buffs and debuffs taken into account
- Shows DoTs (damage over time) and recasts on the timeline
- Adjusts for your stats (critical hit, direct hit, determination, skill/spell speed)
- Lets you set boss untargetable windows and the range used for PPS

## Supported jobs

The following jobs are currently supported.

| Abbreviation | Job |
|------|---------|
| WHM | White Mage |
| DRG | Dragoon |
| BRD | Bard |
| PCT | Pictomancer |
| BLM | Black Mage |
| SAM | Samurai |
| MNK | Monk |
| SCH | Scholar |
| AST | Astrologian |
| SGE | Sage |
| PLD | Paladin |
| WAR | Warrior |
| GNB | Gunbreaker |
| DRK | Dark Knight |

To request another job, please [open an issue](#bugs-requests-and-contact).

## How to access

- URL: <https://ff14-rotation-calc.forestry-for.workers.dev/en/> (served on Cloudflare Workers)
- Japanese version: <https://ff14-rotation-calc.forestry-for.workers.dev/> (you can also switch with **日本語** at the top of the screen)
- No login required. Just open it in your browser
- Recommended: a desktop browser (latest Chrome / Edge / Firefox)

---

## Basic workflow

1. **Select a job and level**
   - Press the job picker at the top of the screen (the button with the selected job's name), then choose a supported job and level in the panel that opens
2. **Place actions on the timeline**
   - Drag and drop action icons from the job palette onto the timeline on the right
3. **Reorder them on the timeline**
   - Drag placed actions left or right to adjust the order
4. **Check the expected potency and PPS**
   - They are recalculated every time you place an action and shown in the summary bar at the top of the screen

---

## Screen layout

### Header (top of the screen)

- **Job picker**: A button showing the selected job and level. Press it to open a panel where you can choose a job and level
  - You can filter jobs by name or abbreviation (e.g. "black", "BLM"). Recently used jobs are also listed. Unsupported jobs cannot be selected
  - **Level (alpha)**: Choose from 70 / 80 / 90 / 100. Below Lv100, action availability and potencies are for reference only, so this is an alpha feature
- **日本語** (language link): Opens the same page in Japanese. The timeline you are working on is kept (on the Japanese version, the link reads **English** and brings you back)
- **Settings** (gear button): Change the theme (Light / Dark / Match OS) and the accent color
- For how to use "Save & share" and "Saved timelines", see "[I want to share a timeline or open it on another device](#q-i-want-to-share-a-timeline-or-open-it-on-another-device)" and "[I want to find a saved timeline later](#q-i-want-to-find-a-saved-timeline-later)" in the FAQ

### Summary bar (below the header)

| Item | Description |
|------|------|
| Total expected potency | Expected potency from 0s until the end of the last GCD's recast (including DoTs; DoT ticks after that are not counted). Without GCDs, the expected potency of all placed actions and DoTs |
| PPS (overall) | Total expected potency ÷ duration (the PPS of the same range as "All" in "PPS range") |
| PPS (range) | PPS of the range set with "PPS range" |
| DoT expected potency | The DoT part of the total expected potency |
| Duration | Time until the end of the last GCD's recast. When DoTs tick after that, the time of the last DoT tick is shown next to it (without GCDs, the time of the last DoT tick) |

### Job palette (left side)

- **Stats**: Critical Hit, Direct Hit Rate, Determination and Skill/Spell Speed. The rates, multipliers and GCD calculated from your input are also shown
- The actions the job can use (split into GCD / oGCD, each with its potency)

### Timeline (right side)

The timeline is split into several lanes.

| Lane | Description |
|--------|------|
| GCD | Main actions on the global cooldown |
| oGCD | Abilities (weaving slots) |
| Resources | Job gauges and stack-type resources |
| Buffs | Durations of self buffs and party buffs |
| Recasts | Recast status of each action |
| DoT | Durations of damage over time effects |

### Setting the calculation range

- **PPS range**: Set the time range used to calculate the total potency and PPS
- **Untargetable**: Set when the boss becomes untargetable. No potency is dealt while it is untargetable, so that time is excluded from the calculation
- **Multi-target**: Set a number of enemies and the time range in which that many enemies are present. AoE actions used in that time range are calculated as hitting that number of enemies (the target cap and potency falloff of each action are applied. DoTs are calculated for one enemy)

---

## Limitations

This tool focuses on calculating **damage rotations against a single boss** (for tanks and healers too, only the potency of attack actions is calculated). The following are **not supported**.

- **Actions that target allies are out of scope**
  - Healing, mitigation, buffs on allies, shields and so on are not included in the calculation (support actions of healers and tanks are not supported)
- **Positionals are assumed to succeed, and distance falloff is not considered**
  - Flank / rear positional bonuses are included in potencies on the assumption that the positional succeeds (Monk, Samurai, Dragoon)
  - You cannot switch positionals between success and failure (True North has no effect and can only be placed to track its recast)
  - Distance-based falloff of AoE actions is not applied
- **A single boss is assumed**
  - Potency for multiple hits and multiple targets is supported only for some actions
- **Lv100 is assumed**
  - The level setting is an alpha feature. Below Lv100, potencies may not be accurate
- **No guarantee of correctness**
  - Results may differ from the official formulas or action specifications. Please combine them with in-game measurements for final decisions

---

## FAQ

### Q. The potency differs slightly from official values or other tools

The formulas in this tool are its own implementation. Differences in the order buffs are applied, rounding and the expected hit model can cause gaps of a few percent. The goal is **relative comparison between rotations**, and exact matching of absolute values is not guaranteed.

### Q. An action icon is missing or not shown

Icons are registered one by one when a job or action is added. Some may be missing because they are not registered yet or their URL is broken. Please open an issue and the icon will be replaced.

### Q. The job I want to use is not supported

Currently only 14 jobs are supported: WHM / DRG / BRD / PCT / BLM / SAM / MNK / SCH / AST / SGE / PLD / WAR / GNB / DRK. Other jobs will be added over time. Requests are welcome in Issues.

### Q. Is my data saved?

What you are working on (the selected job, level, stats, timeline, boss untargetable windows and so on) is saved automatically in your browser's LocalStorage. In the same browser, you can pick up where you left off even after reloading the page or closing and reopening the tab.

- Auto-saved data is stored only in your browser. Clearing the browser's browsing data (site data) also deletes it (timelines saved to the server with "Save & share", described next, are not deleted. However, they no longer appear in "Saved timelines". They can still be opened from their share URLs)
- Auto-saved data is not carried over to other browsers or devices. To open a timeline on another device or show it to someone, use "Save & share", described next

### Q. I want to share a timeline or open it on another device

Saving a timeline to the server with "Save & share" at the top of the screen creates a share URL. With this URL, the same timeline can be opened in other browsers and on other devices. You can optionally give it a title of up to 100 characters. You can also optionally choose the content (the Dawntrail savage raids and the ultimate raids of each expansion).

- Anyone who knows the URL can open the timeline
- A saved timeline, its title and its content cannot be changed later. If you edit it and save it again, it gets a different URL. You can delete it from the "Saved timelines" list described next
- Opening a share URL replaces the timeline you are working on with the shared one (if your timeline has entries, you are asked to confirm before it is replaced)
- When you open a share URL, the content chosen and the title given when it was saved are shown at the top of the screen
- Editing and saving a timeline opened from a share URL does not change the original timeline (it is saved as a copy with a different URL)
- A timeline deleted by the person who saved it cannot be opened from its share URL (opening it shows that it was deleted)
- If you save or delete many times in a short period, you will not be able to save or delete for a while
- When you open the save dialog, a bot check (Cloudflare [Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)) is shown, and you cannot save until the check is complete. For the check, information about your browser is sent to Cloudflare (only when you open the save dialog)

### Q. I want to find a saved timeline later

With "Saved timelines" at the top of the screen, you can list the timelines saved in this browser, newest first. Even if you forgot to note a share URL, you can choose the timeline from the list and open it. Each row of the list is a link to its share URL, so you can also open it in a new tab.

- Only timelines saved in the same browser appear in the list (there is no login; your browser is identified by a cookie). Timelines saved in other browsers or on other devices do not appear
- With "Copy" on each row of the list, you can copy the share URL of that row
- With "Delete" on each row of the list, you can delete a saved timeline. Once deleted, it can no longer be opened from its share URL, even by people you shared the URL with. This cannot be undone
- If you clear the browser's browsing data (site data), or 400 days pass without saving or viewing the list, the timelines saved until then no longer appear in the list and can no longer be deleted. The timelines themselves remain on the server, so they can still be opened from their share URLs

---

## Bugs, requests and contact

- **GitHub repository**: <https://github.com/Sakuya398-Yamada/ff14_rotation_calc>
- **GitHub Issues**: <https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues>
  - Please first search the existing issues for the same report
  - When opening a new issue, it helps to include the job, the steps, the expected result and the actual result
- **Email**: forestry.for@gmail.com
  - If you don't have a GitHub account, feel free to send an email

---

Build instructions, the tech stack and coding standards for developers are in [CONTRIBUTING.md](./CONTRIBUTING.md) (in Japanese).

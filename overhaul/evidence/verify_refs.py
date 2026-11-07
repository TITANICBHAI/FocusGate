# Run against a PRISTINE v1.1.0 checkout to confirm every file:line and symbol that plan.md cites (150 checks; all passed on the zip this pack was written from).
# After the agent starts changing code, mismatches are expected. Usage: python3 -I evidence/verify_refs.py <repo_dir> evidence/ui-typecheck-remaining-after-config.txt
# Checks every file:line / symbol the pack cites against a pristine FocusGate checkout.
# Usage: python3 -I verify_refs.py <repo_dir> <typecheck_log>
import os, re, sys
repo, tclog = sys.argv[1], sys.argv[2]
ok = bad = 0
def lines(rel):
    p = os.path.join(repo, rel)
    if not os.path.isfile(p): return None
    with open(p, encoding="utf-8", errors="replace") as f: return f.read().split("\n")
def report(good, msg):
    global ok, bad
    if good: ok += 1
    else: bad += 1; print("MISMATCH", msg)

# (file, line, substring) : substring must appear within +-3 lines of the cited line
LINE_CLAIMS = [
 ("src/background/chrome.ts", 67, "onAlarm: ChromeEvent<string>"),
 ("src/background/chrome.ts", 141, "function adaptEvent"),
 ("src/background/chrome.ts", 175, "onAlarm: chrome.alarms.onAlarm"),
 ("src/background/chrome.ts", 126, "onInstalled: ChromeEvent"),
 ("src/background/chrome.ts", 233, "onInstalled: chrome.runtime.onInstalled"),
 ("src/background/chrome.ts", 250, "tabActivated: adaptEvent"),
 ("src/background/worker.ts", 71, "onError?("),
 ("src/background/worker.ts", 131, "onInstalled: WorkerEventSource"),
 ("src/background/worker.ts", 170, "const onError"),
 ("src/background/worker.ts", 208, "const ensureAlarmsFor"),
 ("src/background/worker.ts", 247, "const reconciler = createReconciler"),
 ("src/background/worker.ts", 366, "createGuardedStateWriteService"),
 ("src/background/worker.ts", 391, "addSites"),
 ("src/background/worker.ts", 436, "const handleInstalled"),
 ("src/background/worker.ts", 442, "session.recover()"),
 ("src/background/worker.ts", 455, "onAlarmListener"),
 ("src/background/worker.ts", 458, "onCommandListener"),
 ("src/background/worker.ts", 461, "onMessageListener"),
 ("src/background/worker.ts", 529, "return { handleInstalled, handleAlarm, handleCommand, handleMessage, start }"),
 ("src/background/reconcile.ts", 282, "export function createReconciler"),
 ("src/background/alarmHandler.ts", 68, "TASK_REMINDER_ALARM_PREFIX"),
 ("src/background/alarms.ts", 41, "export async function ensureAlarms"),
 ("src/background/guardedStateWrites.ts", 18, "GuardedStateWriteDependencies"),
 ("src/shared/plan.ts", 454, "export function assessUrl"),
 ("src/shared/guardMutations.ts", 76, "useGlobalLists"),
 ("src/shared/defaults.ts", 76, "Stay focused. You've got this."),
 ("src/ui/dashboard/DashboardPage.tsx", 1, 'from "react"'),
 ("src/ui/dashboard/HabitsCard.tsx", 20, "todayKey"),
 ("src/ui/panel/views/RulesScreen.tsx", 11, "computeBlockPlan"),
 ("src/ui/panel/views/RulesScreen.tsx", 35, "RULE_SECTIONS"),
 ("src/ui/panel/views/RulesScreen.tsx", 42, "WEEKDAYS"),
 ("src/ui/panel/views/RulesScreen.tsx", 806, "isClockTime"),
 ("src/ui/panel/views/RulesScreen.tsx", 811, "ScheduleSection"),
 ("src/ui/panel/views/RulesScreen.tsx", 843, "crypto.randomUUID"),
 ("src/ui/panel/views/FocusScreen.tsx", 47, "LOCK_OPTIONS"),
 ("src/ui/panel/views/FocusScreen.tsx", 53, "LOCK_SUMMARY"),
 ("src/ui/panel/views/FocusScreen.tsx", 509, "Stopping early needs your password"),
 ("src/ui/panel/PanelPage.tsx", 78, "tabpanel"),
 ("src/ui/panel/PanelPage.tsx", 101, "fg-tabbar"),
 ("src/ui/components/primitives.tsx", 226, "role=\"switch\""),
 ("src/ui/components/primitives.tsx", 228, "aria-pressed"),
 ("src/ui/components/primitives.tsx", 268, "aria-selected"),
 ("src/ui/styles.css", 125, "system-ui"),
 ("src/ui/styles.css", 572, "Inter"),
 ("src/ui/styles.css", 659, "aria-selected"),
 ("src/ui/styles.css", 778, "fg-chip--live"),
 ("src/ui/styles.css", 894, "aria-pressed"),
 ("src/ui/styles.css", 932, "aria-pressed"),
 ("src/ui/styles.css", 1188, "aria-pressed"),
 ("src/ui/styles.css", 949, "font-size: 72px"),
 ("src/ui/styles.css", 676, "text-transform: uppercase"),
 ("src/ui/styles.css", 830, "text-transform: uppercase"),
 ("src/ui/styles.css", 941, "text-transform: uppercase"),
 ("src/ui/styles.css", 1105, "text-transform: uppercase"),
 ("src/ui/dashboard/DashboardSettings.tsx", 633, "heartbeat"),
]
for rel, line, sub in LINE_CLAIMS:
    L = lines(rel)
    if L is None: report(False, f"{rel}: file missing"); continue
    window = "\n".join(L[max(0, line-4): line+3])
    if sub in window: report(True, "")
    else:
        found = [i+1 for i, t in enumerate(L) if sub in t]
        report(False, f"{rel}:{line} expected {sub!r}; found at lines {found[:6] or 'nowhere'}")

# symbols that must exist somewhere in the file
SYMBOLS = [
 ("src/shared/time.ts", ["export function parseHHMM", "export function localDateKey", "export function isScheduleActiveAt", "export function nextScheduleBoundary", "export function startOfNextLocalDay"]),
 ("src/shared/types.ts", ["interface Schedule", "dailyGoalMin"]),
 ("src/shared/gating.ts", ["Locked until", "I GIVE UP"]),
 ("src/shared/domains.ts", ["normalizeDomain"]),
 ("src/ui/lib/scheduleStatus.ts", ["export function activeScheduleAt"]),
 ("src/ui/panel/PanelPage.tsx", ["statusFromState", "AppHeader"]),
 ("src/ui/dashboard/DashboardPage.tsx", ["class DashboardErrorBoundary", "Run setup"]),
 ("src/ui/blocked/BlockedPage.tsx", ['case "session"', "state.dayStats[dateKey]?.blocks", "chrome.tabs.getCurrent()"]),
 ("src/ui/panel/views/YouScreen.tsx", ["HabitsCard", "TasksView", "ReflectionCard"]),
 ("src/ui/hooks/storageStore.ts", ["state/write"]),
 ("tests/claims.test.ts", ["You can stop any time with a confirmation."]),
 ("tests/ui/panelRender.test.tsx", ["fg-btn--primary"]),
 ("tests/ui/primitives.test.tsx", ['aria-pressed="true"']),
 ("public/manifest.json", ['"version"', "toggle-focus", "block-current-site"]),
]
for rel, subs in SYMBOLS:
    L = lines(rel)
    if L is None: report(False, f"{rel}: file missing"); continue
    text = "\n".join(L)
    for s in subs: report(s in text, f"{rel}: {s!r} not found")

# files the plan edits must exist; files the plan creates must not exist yet
MUST_EXIST = ["src/ui/mount.tsx","src/ui/hooks/storageStore.ts","src/ui/lib/protectionStatus.ts","src/ui/lib/guardState.ts","src/ui/blocked/BlockedPage.tsx","src/ui/dashboard/DashboardStats.tsx","src/ui/components/AchievementsCard.tsx","src/ui/onboarding/OnboardingPage.tsx","tests/background/worker.test.ts","tests/background/guardedStateWrites.test.ts","tests/shared/blockPage.test.ts","tests/ui/scheduleStatus.test.ts","tests/ui/foundation.test.ts","tests/ui/themeTokens.test.ts","CHANGELOG.md","public/icons/icon-16.png","public/icons/icon-32.png","public/icons/icon-48.png","public/icons/icon-128.png","tsconfig.json","design.md","fixes/AGENT_PROMPT.md","src/shared/plan.ts","src/shared/domains.ts"]
for rel in MUST_EXIST: report(os.path.isfile(os.path.join(repo, rel)), f"missing file: {rel}")
MUST_NOT_EXIST = ["src/ui/components/ErrorBoundary.tsx","src/ui/lib/scheduleSummary.ts","src/ui/lib/weekCoverage.ts","src/ui/components/WeekStrip.tsx","src/ui/components/StatusStrip.tsx","src/ui/components/WeekBars.tsx","src/shared/sessionClock.ts","tsconfig.ui.json","src/ui/env.d.ts","tools/e2e","tests/background/chromeAdapter.test.ts","src/ui/panel/views/ScheduleSection.tsx"]
for rel in MUST_NOT_EXIST: report(not os.path.exists(os.path.join(repo, rel)), f"already exists (plan says new): {rel}")
# banned in the plan's claims
for rel in ["src/background/chrome.ts"]:
    t = "\n".join(lines(rel) or [])
    report("onStartup" not in t and "onError" not in t, f"{rel}: plan says no onStartup/onError wiring exists")
bg = ""
for fn in os.listdir(os.path.join(repo, "src/background")):
    if fn.endswith(".ts"): bg += open(os.path.join(repo, "src/background", fn), encoding="utf-8").read()
report("onStartup" not in bg, "src/background: plan says there is no runtime.onStartup anywhere")

# typecheck groups G1..G6: each cited file:line must appear in the log of remaining errors
groups = {
 "G1": [("AchievementsCard",31),("OnboardingPage",72),("OnboardingPage",73),("FocusScreen",410),("RulesScreen",347),("RulesScreen",354),("RulesScreen",662),("YouScreen",142),("YouScreen",361)],
 "G2": [("DashboardStats",118),("FocusScreen",504),("RulesScreen",66),("RulesScreen",301),("RulesScreen",785),("RulesScreen",794)],
 "G3": [("storageStore",222),("storageStore",226),("storageStore",308)],
 "G4": [("protectionStatus",37),("protectionStatus",38)],
 "G5": [("FocusScreen",386),("FocusScreen",389),("FocusScreen",673)],
 "G6": [("YouScreen",47),("YouScreen",52),("YouScreen",203),("YouScreen",223)],
}
log = open(tclog, encoding="utf-8").read()
errs = re.findall(r"^(\S+?)\((\d+),\d+ TS\d+", log, re.M)
have = {(os.path.basename(f).rsplit(".",1)[0], int(n)) for f, n in errs}
listed = set()
for g, items in groups.items():
    for key in items:
        listed.add(key); report(key in have, f"typecheck group {g}: {key[0]}:{key[1]} not in error log")
extra = sorted(have - listed)
report(not extra, f"errors in the log that no group covers: {extra}")
report(len(errs) == 27, f"expected 27 errors in the log, found {len(errs)}")
print(f"\n{ok} checks ok, {bad} mismatches")
sys.exit(1 if bad else 0)

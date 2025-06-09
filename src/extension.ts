import * as vscode from "vscode";
import * as path from "path";
import {
  DailyQuestState,
  loadDailyQuests,
  updateQuestProgress,
  checkAndResetDailyQuests,
  getRank
} from "./quests";
import { addXP } from "./xp"
import { QuestTreeProvider } from "./questTreeProvider";

const XP_FILE_NAME = ".codeleveler.json";

interface XPData {
  xp: number;
  rank: string;
}

const ranks = [
  { name: "E-Rank | 🔰 Rookie Hunter", xp: 0 },
  { name: "D-Rank | 🚶‍♂️ Wandering Adventurer", xp: 101 },
  { name: "C-Rank | 👻 Spirit Exorcist", xp: 501 },
  { name: "B-Rank | 🦾 Arcane Alchemist", xp: 1001 },
  { name: "A-Rank | 🍥 Fox Hokage", xp: 3001 },
  { name: "S-Rank | 👊 The One Punch", xp: 5001 },
  { name: "SS-Rank | 💀 Bankai Master", xp: 10001 },
  { name: "SSS-Rank | 🌑 Shadow Monarch", xp: 20001 },
  { name: "Sukuna-Rank | King of Curses", xp: 30001},
  { name: "No.1-Rank | 🦸‍♂️ One For All", xp: 40001 },
  { name: "Gojo-Rank | 🤞 Special Grade Sorcerer", xp: 50001 },
  { name: "Chimera-Rank | 🐜 Ant King", xp: 60001},
  { name: "Overlord-Rank | ⏳ Sorcerer King", xp: 70001 },
  { name: "Titan-Rank | 👹 Founding Titan", xp: 80001 },
  { name: "Devil-Rank | 🪚 Chainsaw Man", xp: 90001 },
  { name: "Liberation-Rank | 🏴‍☠️ Sun God Nika", xp: 100001 },
  { name: "Legendary-Rank | 🔮 Reincarnated Sage", xp: 125001 },
  { name: "Exodia-Rank | 🃏 Forbidden One", xp: 150001 },
  { name: "Dragon-Rank | 🐲 Zeno Sama", xp: 175001 },
  { name: "Celestial-Rank | 🔥 Slime Demon Lord", xp: 200001 },
  { name: "Pinnacle-Rank | ☀️ Lion Sin of Pride", xp: 300001 },
  { name: "Multiversal-Rank | ⏳ The Conqueror", xp: 400001 },
  { name: "The One Above All | 🌟 Supreme Principle", xp: 500001 },
];


export function getRankLocal(xp: number): string {
  let currentRank = "E-Rank | 🔰 Rookie Hunter";
  for (const rank of ranks) {
    if (xp >= rank.xp) {
      currentRank = rank.name;
    } else {
      break;
    }
  }
  return currentRank;
}

export function getNextRankXP(xp: number): number | null {
  for (const rank of ranks) {
    if (rank.xp > xp) {
      return rank.xp;
    }
  }
  return null;
}

export function getXPFilePath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;
  return path.join(workspaceFolders[0].uri.fsPath, XP_FILE_NAME);
}

export function readXP(context: vscode.ExtensionContext): XPData {
  try {
    const xpData = context.globalState.get<XPData>("xpData");
    if (
      !xpData ||
      typeof xpData.xp !== "number" ||
      typeof xpData.rank !== "string"
    ) {
      return { xp: 0, rank: "E-Rank | 🔰 Rookie Hunter" };
    }
    return xpData;
  } catch {
    return { xp: 0, rank: "E-Rank | 🔰 Rookie Hunter" };
  }
}

export async function writeXP(
  context: vscode.ExtensionContext,
  data: XPData
): Promise<void> {
  try {
    await context.globalState.update("xpData", data);
  } catch (error) {
    console.error("❌ Error saving XP data:", error);
  }
}

let statusBarItem: vscode.StatusBarItem;
let buffStatusBarItem: vscode.StatusBarItem;

export async function updateStatusBar(context: vscode.ExtensionContext) {
  const xpData = context.globalState.get<{ xp: number; rank: string }>("xpData") || {
    xp: 0,
    rank: "E-Rank | 🔰 Rookie Hunter",
  };

  const nextXP = getNextRankXP(xpData.xp);
  const currentRankData = ranks.find((r) => r.name === xpData.rank);
  const currentRankXP = currentRankData ? currentRankData.xp : 0;

  let progressText = "";

  if (nextXP !== null) {
    const percent = Math.min(
      100,
      Math.floor(((xpData.xp - currentRankXP) / (nextXP - currentRankXP)) * 100)
    );
    const progressBar =
      "█".repeat(Math.floor(percent / 10)) +
      "░".repeat(10 - Math.floor(percent / 10));
    progressText = ` | ${progressBar} ${percent}%`;
  } else {
    progressText = " | ██████████ 100%";
  }

  statusBarItem.text = `💠 ${xpData.rank} (${xpData.xp} XP)${progressText}`;
  statusBarItem.show();

  const { activeBuffs } = await loadDailyQuests(context);
  const now = Date.now();
  const active = activeBuffs.filter((b) => b.expiresAt > now);

  if (active.length > 0) {
    const buffsText = active
      .map((b) => {
        if (b.type === "xpMultiplier") {
          const timeLeft = Math.ceil((b.expiresAt - now) / 1000);
          return `🔥 EXP x${b.multiplier} (${timeLeft}s)`;
        }
        if (b.type === "rankBoostChance") {
          const timeLeft = Math.ceil((b.expiresAt - now) / 1000);
          return `🌟 Rank Boost Chance (${timeLeft}s)`;
        }
        return "";
      })
      .join(" | ");
    buffStatusBarItem.text = buffsText;
    buffStatusBarItem.show();
  } else {
    buffStatusBarItem.hide();
  }
}

export async function activate(context: vscode.ExtensionContext) {


  let xpData = context.globalState.get<XPData>("xpData") || { xp: 0, rank: "E-Rank | 🔰 Rookie Hunter" };
  checkAndResetDailyQuests(context);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  buffStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );
  const questButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    98
  );
  questButton.text = "📜 Daily Quests";
  questButton.command = "codeleveling.showDailyQuests";
  questButton.tooltip = "ดูภารกิจรายวัน";
  questButton.show();

  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(buffStatusBarItem);
  context.subscriptions.push(questButton);

  await context.globalState.update("xpData", xpData);
  await updateStatusBar(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("codeleveling.updateUI", async () => {
      // อัปเดต status bar
      await updateStatusBar(context);
    })
  );
  // Auto login quest completion
  (async () => {
    await updateQuestProgress(context, "daily_login", 1);
    vscode.commands.executeCommand("codeleveling.showDailyQuests");
  })();

  // เช็ครีเซ็ต Daily Quest
  await checkAndResetDailyQuests(context);

  const questTreeProvider = new QuestTreeProvider(context);
  vscode.window.registerTreeDataProvider("questTree", questTreeProvider);

  // กดรีเฟรชจาก Command ได้
  const refreshCmd = vscode.commands.registerCommand("code-leveling.refreshQuests", () => {
    questTreeProvider.refresh();
  });

  context.subscriptions.push(refreshCmd);

  let lastTypingTime = Date.now();
  let typingStartTime = Date.now();
  let comboStarted = false;

  // Combo 30 นาที
  setInterval(async () => {
    const now = Date.now();
    if (comboStarted && now - lastTypingTime > 2 * 60 * 1000) {
      comboStarted = false;
    }
    if (comboStarted && now - typingStartTime >= 30 * 60 * 1000) {
      await updateQuestProgress(context, "longest_combo", 1);
      comboStarted = false;
    }
  }, 10000);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      try {
        if (event.contentChanges.length === 0) return;

        let totalChars = 0;
        let typedRefactor = 0;
        let totalXP = 0;
        let newLines = 0;

        for (const change of event.contentChanges) {
          const text = change.text;
          totalChars += text.length;

          newLines += (text.match(/\n/g) || []).length;

          if (text.length > 1) {
            totalXP += 1;
          } else if (text.trim() !== "") {
            totalXP += 1;
          }

          if (text.includes("Sun God Nikga")) {
            typedRefactor += 1;
          }
        }

        // นับบรรทัด
        if (newLines > 0) {
          await updateQuestProgress(context, "type_1000_lines", newLines);
        }

        // นับตัวอักษร
        let totalTodayChars =
          context.globalState.get<number>("todayCharCount") || 0;
        totalTodayChars += totalChars;
        await updateQuestProgress(context, "type_5000_chars", totalChars);
        await context.globalState.update("todayCharCount", totalTodayChars);

        if (totalChars > 0) {
          lastTypingTime = Date.now();
          if (!comboStarted) {
            typingStartTime = Date.now();
            comboStarted = true;
          }
        }

        if (totalChars > 0) {
          await updateQuestProgress(context, "write_1000_chars", totalChars);
        }

        if (typedRefactor > 0) {
          await updateQuestProgress(
            context,
            "type_special_word",
            typedRefactor
          );
        }

 if (totalXP > 0) {
  const { activeBuffs } = await loadDailyQuests(context);
  const now = Date.now();
  const multiplier =
    activeBuffs.find(
      (b) => b.type === "xpMultiplier" && b.expiresAt > now
    )?.multiplier ?? 1;

  await addXP(context, Math.floor(totalXP * multiplier));
}

      } catch (error) {
        console.error("❌ Error in text change handler:", error);
      }
    })
  );

  // File save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async () => {
      await updateQuestProgress(context, "save_file_5_times", 1);
    })
  );

  // Git tracking
  async function initGitTracking() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    for (const folder of workspaceFolders) {
      const gitPath = vscode.Uri.joinPath(folder.uri, '.git');

      try {
        // ตรวจสอบ git init
        const gitStat = await vscode.workspace.fs.stat(gitPath);
        if (gitStat && !context.globalState.get(`git_detected_${folder.uri.fsPath}`)) {
          await updateQuestProgress(context, "git_init", 1);
          await context.globalState.update(`git_detected_${folder.uri.fsPath}`, true);
        }

        // ตรวจ commit
        const commitMsgWatcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(folder, '.git/COMMIT_EDITMSG')
        );

        commitMsgWatcher.onDidChange(async () => {
          await updateQuestProgress(context, "git_commit", 1);
        });

        // ตรวจ push
        const refsWatcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(folder, '.git/refs/remotes/**')
        );

        refsWatcher.onDidChange(async () => {
          await updateQuestProgress(context, "git_push", 1);
        });

        refsWatcher.onDidCreate(async () => {
          await updateQuestProgress(context, "git_push", 1);
        });

        context.subscriptions.push(commitMsgWatcher, refsWatcher);

      } catch (error) {
        console.log('No git repository found in', folder.uri.fsPath);
      }
    }
  }

  initGitTracking();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeleveling.showDailyQuests",
      async () => {
        const state = await loadDailyQuests(context);
        const items = state.quests.map((q) => ({
          label: q.completed ? "✅ " + q.name : "🔲 " + q.name,
          description: `${q.progress}/${q.target} - ${q.description}`,
          detail: `รางวัล: ${q.reward.type === "xp"
            ? `EXP +${q.reward.amount}`
            : q.reward.type === "xpMultiplier"
              ? `EXP x${q.reward.multiplier} (${q.reward.durationSeconds} วินาที)`
              : "Chance for Rank Boost"
            }`,
        }));

        await vscode.window.showQuickPick(items, {
          placeHolder: "ภารกิจรายวันของคุณ",
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeleveling.start", () => {
      vscode.window.showInformationMessage("🚀 Code Leveling Started!");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeleveling.reset", async () => {
      xpData = { xp: 0, rank: "E-Rank | 🔰 Rookie Hunter" };
      await writeXP(context, xpData);
      vscode.window.showInformationMessage("🧹 XP ถูกรีเซ็ตเรียบร้อยแล้ว!");
      await context.globalState.update("xpData", xpData);
      await updateStatusBar(context);
    })
  );

  vscode.window.showInformationMessage(
    "🎮 Code Leveling Extension is now active!"
  );
}
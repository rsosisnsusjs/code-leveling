import * as vscode from "vscode";
import { updateStatusBar } from "./extension";

export interface DailyQuest {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  reward: {
    type: "xp" | "xpMultiplier" | "rankBoostChance";
    amount?: number;
    multiplier?: number;
    durationSeconds?: number;
  };
}

export interface Buff {
  type: "xpMultiplier" | "rankBoostChance";
  multiplier?: number;
  expiresAt: number;
}

export interface DailyQuestState {
  quests: DailyQuest[];
  activeBuffs: Buff[];
}

const defaultQuests: DailyQuest[] = [
  {
    id: "daily_login",
    name: "ผจญภัยสู่โลกกว้าง",
    description: "ล็อกอิน VS Code เพื่อรับ EXP",
    target: 1,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 50 },
  },
  {
    id: "write_1000_chars",
    name: "พิมพ์โค้ด 1000 ตัวอักษร",
    description: "ช่วยเขียนโค้ด 1000 ตัวอักษรให้ที! ฉันจะไม่ยอมแพ้จนกว่าจะได้!",
    target: 1000,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 200 },
  },
  {
    id: "save_file_5_times",
    name: "บันทึกไฟล์ 5 ครั้ง",
    description: "ทุกการบันทึกคือก้าวสู่ความแข็งแกร่ง! Save โค้ดใน VS Code 5 ครั้ง!",
    target: 5,
    progress: 0,
    completed: false,
    reward: { type: "xpMultiplier", multiplier: 2, durationSeconds: 120 },
  },
  {
    id: "type_special_word",
    name: "พิมพ์คำศักดิ์สิทธิ์! 'Sun God Nikga'",
    description: "พิมพ์คำว่า 'Sun God Nikga' ในโค้ดของคุณ!",
    target: 1,
    progress: 0,
    completed: false,
    reward: { type: "rankBoostChance" },
  },
  {
    id: "git_commit",
    name: "จักรพรรดิแห่งโค้ด",
    description: "commit โค้ด 1 ครั้ง โลกนี้จะต้องจารึกโค้ดของคุณ!",
    target: 1,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 100 },
  },
  {
    id: "git_push",
    name: "พลังแห่งการพัฒนา",
    description: "push โค้ดไปยัง remote ของคุณ 5 ครั้ง! พลังของคุณจะครอบงำทุกสิ่ง!",
    target: 5,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 1000 },
  },
  {
    id: "git_init",
    name: "ผู้ปลุกตำนาน",
    description: "ใช้ git init กับโปรเจกต์ใดโปรเจกต์หนึ่ง",
    target: 1,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 200 },
  },
  {
    id: "type_5000_chars",
    name: "เขียนโค้ดขั้นเทพ",
    description: "พิมพ์โค้ดรวม 5000 ตัวอักษรในวันเดียว",
    target: 5000,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 1000 },
  },
  {
    id: "type_1000_lines",
    name: "ราชาแห่งการพัฒนา",
    description: "พิมพ์ครบ 1000 บรรทัด เพื่อพิสูจน์ความแข็งแกร่งของคุณ!",
    target: 1000,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 1669 },
  },
  {
    id: "longest_combo",
    name: "หัตถ์แห่งเทพ! พิมพ์ต่อเนื่อง 30 นาที!",
    description: "พิมพ์โค้ดต่อเนื่อง 30 นาทีโดยไม่มีการหยุดพักเกิน 2 นาที!",
    target: 1,
    progress: 0,
    completed: false,
    reward: { type: "xp", amount: 500 },
  },
];

export async function loadDailyQuests(
  context: vscode.ExtensionContext
): Promise<DailyQuestState> {
  let state = context.globalState.get<DailyQuestState>("dailyQuestState");
  if (!state) {
    state = {
      quests: defaultQuests,
      activeBuffs: [],
    };
    await context.globalState.update("dailyQuestState", state);
  }
  return state;
}

export async function updateQuestProgress(
  context: vscode.ExtensionContext,
  questId: string,
  progressDelta: number
): Promise<{
  gainedXP?: number;
  gainedBuffs?: Buff[];
  questCompleted?: boolean;
}> {
  const state = await loadDailyQuests(context);
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return {};

  quest.progress += progressDelta;

  let gainedXP = 0;
  let gainedBuffs: Buff[] = [];
  let questCompleted = false;

  if (quest.progress >= quest.target) {
    quest.progress = quest.target;
    quest.completed = true;
    questCompleted = true;

    if (quest.reward.type === "xp") {
      // คำนวณ multiplier จาก Buff
      const now = Date.now();
      const activeMultiplier = state.activeBuffs
        .filter((buff) => buff.type === "xpMultiplier" && buff.expiresAt > now)
        .reduce((total, buff) => total * (buff.multiplier ?? 1), 1);

      const baseXP = quest.reward.amount ?? 0;
      gainedXP = Math.floor(baseXP * activeMultiplier);
      
      // อัปเดต xpData
      let xpData = context.globalState.get<{ xp: number; rank: string }>("xpData") || {
        xp: 0,
        rank: "E-Rank | Rookie Hunter",
      };
      
      xpData.xp += gainedXP;
      const newRank = getRank(xpData.xp);
      
      // ตรวจสอบการเลื่อนขั้น
      if (newRank !== xpData.rank) {
        xpData.rank = newRank;
        vscode.window.showInformationMessage(
          `🎉 คุณเลื่อนขั้นเป็น ${newRank}!`
        );
      }
      
      await context.globalState.update("xpData", xpData);
      
      // อัปเดต Status Bar ทันที
      await updateStatusBar(context);
      
      vscode.window.showInformationMessage(
        `🎉 คุณได้รับ EXP +${gainedXP} (Base ${baseXP} x${activeMultiplier.toFixed(2)}) จากภารกิจ '${quest.name}'`
      );

    } else if (quest.reward.type === "xpMultiplier") {
      const buff: Buff = {
        type: "xpMultiplier",
        multiplier: quest.reward.multiplier,
        expiresAt: Date.now() + (quest.reward.durationSeconds ?? 600) * 1000,
      };
      gainedBuffs.push(buff);

      await updateStatusBar(context);

      vscode.window.showInformationMessage(
        `🔥 คุณได้รับ Buff EXP x${quest.reward.multiplier} นาน ${quest.reward.durationSeconds} วินาที!`
      );

    } else if (quest.reward.type === "rankBoostChance") {
      const buff: Buff = {
        type: "rankBoostChance",
        expiresAt: Date.now() + 600 * 1000,
      };
      gainedBuffs.push(buff);

      // อัปเดต Status Bar เพื่อแสดง Buff
      await updateStatusBar(context);

      vscode.window.showInformationMessage(
        `🌟 คุณได้รับโอกาสเลื่อนขั้นแบบพิเศษจากภารกิจ!`
      );
    }

    // เพิ่มบัฟใหม่ลงใน state.activeBuffs
    state.activeBuffs.push(...gainedBuffs);
  }

  await context.globalState.update("dailyQuestState", state);

  return {
    gainedXP,
    gainedBuffs,
    questCompleted,
  };
}

export function getRank(xp: number): string {
  const ranks = [
    { name: "E-Rank | Rookie Hunter", xp: 0 },
    { name: "D-Rank | Wandering Adventurer", xp: 101 },
    { name: "C-Rank | Spirit Exorcist", xp: 501 },
    { name: "B-Rank | Arcane Alchemist", xp: 1001 },
    { name: "A-Rank | Crimson Hokage", xp: 3001 },
    { name: "S-Rank | The One Punch", xp: 5001 },
    { name: "SS-Rank | Special Grade Sorcerer", xp: 10001 },
    { name: "SSS-Rank | Shadow Monarch", xp: 20001 },
    { name: "Mythical-Rank | Transcendent Being", xp: 40001 },
    { name: "God-Rank | Cosmic Deity", xp: 60001 },
    { name: "True God-Rank | Allfather of Eternity", xp: 100001 },
    { name: "Celestial-Rank | Architect of Creation", xp: 200001 },
    { name: "The One Above All | Supreme Principle", xp: 500001 },
  ];

  let currentRank = "E-Rank | Rookie Hunter";
  for (const rank of ranks) {
    if (xp >= rank.xp) {
      currentRank = rank.name;
    } else {
      break;
    }
  }
  return currentRank;
}

function isNewDay(lastDateStr?: string): boolean {
  if (!lastDateStr) return true;
  const lastDate = new Date(lastDateStr);
  const now = new Date();
  return (
    now.getFullYear() !== lastDate.getFullYear() ||
    now.getMonth() !== lastDate.getMonth() ||
    now.getDate() !== lastDate.getDate()
  );
}

async function resetDailyQuests(context: vscode.ExtensionContext) {
  const state = await loadDailyQuests(context);

  state.quests = defaultQuests.map((q) => ({
    ...q,
    progress: 0,
    completed: false,
  }));

  state.activeBuffs = [];
  await context.globalState.update("todayCharCount", 0);
  await context.globalState.update("dailyQuestState", state);
}

export async function checkAndResetDailyQuests(
  context: vscode.ExtensionContext
) {
  const lastReset = context.globalState.get<string>("lastQuestReset");

  if (isNewDay(lastReset)) {
    await resetDailyQuests(context);
    await context.globalState.update(
      "lastQuestReset",
      new Date().toISOString()
    );
    vscode.window.showInformationMessage(
      "🔄 Daily Quests ได้รีเซ็ตสำหรับวันใหม่แล้ว!"
    );
  }
}

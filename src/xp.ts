import * as vscode from "vscode";
import * as path from "path";
import {
  readXP, getRankLocal, writeXP, updateStatusBar
} from "./extension";

export async function addXP(context: vscode.ExtensionContext, amount: number) {
  const xpData = await readXP(context); // << โหลดค่าล่าสุด
  xpData.xp += amount;

  const newRank = getRankLocal(xpData.xp);
  if (newRank !== xpData.rank) {
    xpData.rank = newRank;
    vscode.window.showInformationMessage(`🎉 คุณเลื่อนขั้นเป็น ${newRank}!`);
  }

  await writeXP(context, xpData);
  await updateStatusBar(context);
}

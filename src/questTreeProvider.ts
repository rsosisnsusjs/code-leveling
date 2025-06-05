import * as vscode from "vscode";
import { loadDailyQuests, DailyQuest } from "./quests";

class QuestTreeItem extends vscode.TreeItem {
  constructor(public readonly quest: DailyQuest) {
    super(quest.name, vscode.TreeItemCollapsibleState.None);

    this.description = `${quest.progress}/${quest.target}`;
    this.tooltip = quest.description;

    this.iconPath = quest.completed
      ? new vscode.ThemeIcon("check")
      : new vscode.ThemeIcon("circle-large-outline");

    // ทำให้คลิกแล้วไม่ error
    this.contextValue = "questItem";
  }
}

export class QuestTreeProvider implements vscode.TreeDataProvider<QuestTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<QuestTreeItem | undefined> =
    new vscode.EventEmitter<QuestTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<QuestTreeItem | undefined> =
    this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: QuestTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<QuestTreeItem[]> {
    const state = await loadDailyQuests(this.context);
    return state.quests.map((q) => new QuestTreeItem(q));
  }
}

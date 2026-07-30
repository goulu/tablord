import type { Command } from './types';

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxDepth: number;
  private onChangeListeners: (() => void)[] = [];

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  subscribe(listener: () => void): () => void {
    this.onChangeListeners.push(listener);
    return () => {
      this.onChangeListeners = this.onChangeListeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.onChangeListeners.forEach(listener => listener());
  }

  execute(command: Command, alreadyExecuted = false): void {
    if (!alreadyExecuted) {
      command.execute();
    }
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.notify();
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
    this.notify();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);
    this.notify();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

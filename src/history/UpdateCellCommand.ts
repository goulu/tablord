import type { Command } from './types';

export class UpdateCellCommand implements Command {
  name: string;
  private cellId: string;
  private oldText: string;
  private newText: string;
  private oldActiveCellId: string | null;
  private newActiveCellId: string | null;
  private applyCellUpdate: (cellId: string, text: string, targetActiveId: string | null) => void;

  constructor(
    name: string,
    cellId: string,
    oldText: string,
    newText: string,
    oldActiveCellId: string | null,
    newActiveCellId: string | null,
    applyCellUpdate: (cellId: string, text: string, targetActiveId: string | null) => void
  ) {
    this.name = name;
    this.cellId = cellId;
    this.oldText = oldText;
    this.newText = newText;
    this.oldActiveCellId = oldActiveCellId;
    this.newActiveCellId = newActiveCellId;
    this.applyCellUpdate = applyCellUpdate;
  }

  execute(): void {
    this.applyCellUpdate(this.cellId, this.newText, this.newActiveCellId);
  }

  undo(): void {
    this.applyCellUpdate(this.cellId, this.oldText, this.oldActiveCellId);
  }
}

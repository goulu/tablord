import type { Table } from '../types/document';
import type { Command } from './types';

export class DocumentCommand implements Command {
  name: string;
  private oldTable: Table;
  private newTable: Table;
  private oldActiveCellId: string | null;
  private newActiveCellId: string | null;
  private applyState: (table: Table, activeCellId: string | null) => void;

  constructor(
    name: string,
    oldTable: Table,
    newTable: Table,
    oldActiveCellId: string | null,
    newActiveCellId: string | null,
    applyState: (table: Table, activeCellId: string | null) => void
  ) {
    this.name = name;
    this.oldTable = oldTable;
    this.newTable = newTable;
    this.oldActiveCellId = oldActiveCellId;
    this.newActiveCellId = newActiveCellId;
    this.applyState = applyState;
  }

  execute(): void {
    this.applyState(this.newTable, this.newActiveCellId);
  }

  undo(): void {
    this.applyState(this.oldTable, this.oldActiveCellId);
  }
}

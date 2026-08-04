import type { Table } from '../types/document';

export interface Importer {
  id: string;
  name: string; // Display name for the menu, e.g. "markdown (.md)"
  fileExtensions: string[]; // File extensions accepted, e.g. ['.md', '.markdown']
  isBinary?: boolean;
  parse: (content: string | ArrayBuffer) => Table | Promise<Table>;
}

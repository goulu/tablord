export interface Cell {
  id: string; // e.g., "A.1"
  text: string;
  className?: string; // used to store classes like 'number', 'text', 'formula' without overwriting each other
  table?: Table; // A cell can optionally contain another table
}

export interface Row {
  id: string; // e.g., "1"
  cells: Cell[];
}

export interface Table {
  id: string; // e.g., "document" or a generated ID for sub-tables
  columns: string[]; // e.g., ["A", "B", "C"]
  rows: Row[];
}

// Initial empty document structure: a table named "document", 1 column "A", 1 row "1".
export const initialDocument: Table = {
  id: "document",
  columns: ["A"],
  rows: [
    {
      id: "1",
      cells: [
        {
          id: "A.1",
          text: "",
        },
      ],
    },
  ],
};

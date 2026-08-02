# Tablord

> A structured spreadsheet editor where cells can contain nested tables.

🌐 **[Try it online → https://goulu.github.io/tablord/](https://goulu.github.io/tablord/)**

---

## What is Tablord?

Tablord is a browser-based spreadsheet editor with a unique twist: any cell can contain a **sub-table**, allowing you to build rich hierarchical document structures rather than flat grids.

Tablord auto-saves your work in the browser's local storage — your document is always there when you come back.

---

## User Manual

### Navigation & Selection

| Action | Key / Input |
|---|---|
| Select a cell | Click |
| Move to next cell (same row) | `Tab` |
| Move to previous cell | `Shift+Tab` |
| Move down (new row) | `Enter` |
| Move between cells | `Arrow keys` |
| Selection Context Menu | Right-click inactive cell |
| Select Row / Column / Sub-table | Context Menu → *Sélectionner la ligne / colonne / sous-table* |
| Delete Selected Row / Column / Sub-table | `Delete` key |
| Native Context Menu (Copy/Paste) | Right-click while editing a cell |
| Deselect | Click outside the table / `Escape` |

---

### Cell Types & Formatting

Each cell has a **type** and optional **heading style** or **text alignment**, changeable via the top bar controls:

| Property | Options | Description |
|---|---|---|
| **Type** | `text`, `number`, `formula`, `markdown` | Controls cell rendering, evaluation, and default alignment. |
| **Heading Style** | Standard, `h1` … `h6` | Applies document heading styles to the cell text. |
| **Alignment** | Left (`⇐`), Center (`⇔`), Right (`⇒`) | Adjusts cell content alignment. The active alignment button highlights when selected cells share the same alignment. |

#### Cell Types Summary

| Type | Alignment | Description |
|---|---|---|
| `text` | Left | Plain text content |
| `number` | Right | Numeric values (auto-adjusted minimum width to fit content tightly) |
| `formula` | Right (result) / Left (editing) | JavaScript expression starting with `=` (auto-adjusted minimum width) |
| `markdown` | Left | Rendered Markdown (headers, bold, links, lists, code, `<hr/>` horizontal rules) |

---

### Formulas

Formulas begin with `=` and support any JavaScript expression.

```
=2 + 3          → 5
=6 * 7          → 42
```

#### Built-in Functions

| Function | Description |
|---|---|
| `COLUMN()` | Column number of the current cell (A=1, B=2 …) |
| `COLUMN("B.3")` | Column number of a specific cell |
| `ROW()` | Row number of the current cell |
| `ROW("B.3")` | Row number of a specific cell |
| `NAME()` | Full address of the current cell (e.g. `B.3`) |
| `NAME("B.3")` | Returns `"B.3"` |
| `SUM()` | Sums cells above in the same column, or range `SUM("A.1", "A.5")` |
| `INC()` | Increments numeric or alphabetical sequence from cell above or target cell |

#### Title & List Auto-Numbering with `INC()`

Tablord provides a unique `INC()` formula function designed to automate title, section, and list numbering across rows and sub-tables.

##### How `INC()` Works

- **Without arguments (`=INC()`)**: Automatically inspects the column upwards to find the nearest non-empty cell and increments its sequence.
- **With a cell reference (`=INC("A.1")`)**: Increments the numeric or alphabetical sequence contained in cell `A.1`.

##### Supported Sequences

`INC()` intelligently increments the rightmost numeric or alphabetical token in a string:

| Initial Cell Value | Formula in Cell Below | Result |
|---|---|---|
| `1` | `=INC()` | `2` |
| `1.1` | `=INC()` | `1.2` |
| `Section 2.A` | `=INC()` | `Section 2.B` |
| `Chapter I` | `=INC()` | `Chapter J` |
| `A` | `=INC()` | `B` |

##### Use Case: Automatic Document Outlines & Lists

When creating hierarchical document structures or importing Markdown files:
1. Set the initial section number in cell `A.1` (e.g. `1.1`).
2. In subsequent section cells `A.2`, `A.3`, etc., enter `=INC()`.
3. If a row is inserted or reordered, section numbers automatically recalculate across the entire document.

#### Cell References

Use cell addresses directly in formulas:

```
=A.1 + A.2      → sum of cells A.1 and A.2
=B.3 * ROW()    → B.3's value times the current row number
```

**Reference styles** (like Excel):

| Style | Example | Meaning |
|---|---|---|
| Relative | `A.1` | Column and row can shift on copy |
| Absolute row | `A.$1` | Row is fixed |
| Absolute column | `$A.1` | Column is fixed |
| Fully absolute | `$A.$1` | Neither shifts |

> 💡 **Tip — click to insert references:** while editing a formula, click any other cell to insert its address at the cursor position. Click the same cell again to toggle to absolute (`$A.$1`), and a third time to remove it.

#### Editing Formulas

- When a formula cell is **active** (being edited), the formula expression is shown.
- When **inactive**, the evaluated result is displayed (right-aligned like a number).
- Press `Escape` to restore the original formula and keep editing.

---

### Nested Tables (Sub-Tables)

Press `Ctrl+Tab` inside any cell to create a **sub-table** inside it. The sub-table inherits the name of that cell (e.g. a sub-table inside `B.3` has cells named `B.3.A.1`, `B.3.B.1`, etc.).

Sub-tables touch cell boundaries directly with zero padding for clean nested layouts.

---

### Document Import

Use the **Import...** dropdown in the top bar to import external files into the current cell:

- **Markdown (`.md`, `.markdown`)**: Imports markdown headers and tables as structured sub-tables with `markdown` cell formatting.
- **Text (`.txt`)**: Imports plain text files into the cell structure.

---

### Undo / Redo System

Full multi-step history tracking:
- `Ctrl+Z` / `↺ Undo`: Undo structure additions, deletions, cell text edits, style, alignment, or imports.
- `Ctrl+Y` / `Ctrl+Shift+Z` / `↻ Redo`: Redo undone actions.

---

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Tab` | Move to next cell / create new column |
| `Shift+Tab` | Move to previous cell |
| `Enter` | Move to next row / create new row |
| `Ctrl+Tab` | Create sub-table in current cell |
| `Delete` | Delete selected row / column / sub-table |
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo action |
| `Arrow keys` | Navigate between cells |
| `Escape` | Cancel / restore original cell content while editing |

---

### Persistence

Your document is automatically saved to **browser local storage** as you type. It is preserved across page reloads and browser restarts — per browser and per user.

When running the dev server locally, the document is also saved to `document.html` in the project root.

---

## Development

```bash
npm install
npm run dev        # start dev server (with /api/load and /api/save)
npm run build      # production build
npm test           # run unit tests
```

The production build is automatically deployed to GitHub Pages via GitHub Actions on every push to the `develop` branch.

---

## License

MIT

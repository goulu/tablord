# Tablord

> A structured spreadsheet editor where cells can contain nested tables.

🌐 **[Try it online → https://goulu.github.io/tablord/](https://goulu.github.io/tablord/)**

---

## What is Tablord?

Tablord is a browser-based spreadsheet editor with a unique twist: any cell can contain a **sub-table**, allowing you to build rich hierarchical document structures rather than flat grids.

Tablord auto-saves your work in the browser's local storage — your document is always there when you come back.

---

## User Manual

### Navigation

| Action | Key / Input |
|---|---|
| Select a cell | Click |
| Move to next cell (same row) | `Tab` |
| Move to previous cell | `Shift+Tab` |
| Move down (new row) | `Enter` |
| Move between cells | `Arrow keys` |
| Deselect | Click outside the table |

---

### Cell Types

Each cell has a **type** that controls its display and alignment. The type can be changed via the dropdown in the top bar when a cell is selected.

| Type | Alignment | Description |
|---|---|---|
| `text` | Left | Plain text |
| `number` | Right | Numeric value |
| `formula` | Right (result) / Left (editing) | Expression starting with `=` |

Tablord **auto-detects** the type when you type: if the content is numeric, the cell becomes a `number`; when you start with `=` it becomes a `formula`.

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

---

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Tab` | Move to next cell / create new column |
| `Shift+Tab` | Move to previous cell |
| `Enter` | Move to next row / create new row |
| `Ctrl+Tab` | Create sub-table in current cell |
| `Arrow keys` | Navigate between cells |
| `Escape` | Restore original cell content while editing |

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

The production build is automatically deployed to GitHub Pages via GitHub Actions on every push to the `new` branch.

---

## License

MIT

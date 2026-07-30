import { handleEnter } from '../src/utils/tableUtils';
import { initialDocument } from '../src/types/document';
let doc = { ...initialDocument };
doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: "1", className: "number" };
const { newTable, newActiveCellId } = handleEnter(doc, doc.rows[0].cells[0].id);
console.log(newTable.rows[1].cells[0]);

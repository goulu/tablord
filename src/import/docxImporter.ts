import mammoth from 'mammoth';
import type { Table } from '../types/document';
import { TextDocumentImporter } from './textDocumentImporter';

export const convertDocxHtmlToMarkdown = (html: string): string => {
  // 1. Convert Headings <h1>..<h6>
  let md = html.replace(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/gis, (_match, level, content) => {
    const text = content.replace(/<a\b[^>]*>(?:<\/a>)?/gi, '').replace(/<[^>]+>/g, '').trim();
    return '\n\n' + '#'.repeat(Number(level)) + ' ' + text + '\n\n';
  });

  // 2. Convert <table>...</table> to GFM Markdown tables
  md = md.replace(/<table\b[^>]*>(.*?)<\/table>/gis, (_match, tableBody) => {
    const rows: string[][] = [];
    const trRegex = /<tr\b[^>]*>(.*?)<\/tr>/gis;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tableBody)) !== null) {
      const cellRegex = /<t[dh]\b[^>]*>(.*?)<\/t[dh]>/gis;
      const rowCells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
        const text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
        rowCells.push(text);
      }
      if (rowCells.length > 0) {
        rows.push(rowCells);
      }
    }
    if (rows.length === 0) return '';
    const maxCols = Math.max(...rows.map(r => r.length));
    let gfm = '\n\n';
    gfm += '| ' + rows[0].map(c => c || '').join(' | ') + ' |\n';
    gfm += '| ' + Array(maxCols).fill('---').join(' | ') + ' |\n';
    for (let r = 1; r < rows.length; r++) {
      gfm += '| ' + rows[r].map(c => c || '').join(' | ') + ' |\n';
    }
    return gfm + '\n';
  });

  // 3. Convert lists (<ol>, <ul>, <li>) with nesting
  function processListNode(htmlStr: string, depth = 0, isOrdered = false): string {
    let output = '';
    let liIndex = 0;
    let cursor = 0;
    while (cursor < htmlStr.length) {
      const liStart = htmlStr.indexOf('<li', cursor);
      if (liStart === -1) break;

      const contentStart = htmlStr.indexOf('>', liStart) + 1;
      let depthCount = 1;
      let pos = contentStart;
      let liEnd = -1;
      while (pos < htmlStr.length) {
        const nextOpen = htmlStr.indexOf('<li', pos);
        const nextClose = htmlStr.indexOf('</li>', pos);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depthCount++;
          pos = nextOpen + 3;
        } else {
          depthCount--;
          if (depthCount === 0) {
            liEnd = nextClose;
            break;
          }
          pos = nextClose + 5;
        }
      }
      if (liEnd === -1) break;

      const liInner = htmlStr.slice(contentStart, liEnd);
      cursor = liEnd + 5;

      const subListStart = liInner.search(/<(ul|ol)\b/i);
      let itemText = '';
      let subListHtml = '';
      if (subListStart !== -1) {
        itemText = liInner.slice(0, subListStart);
        subListHtml = liInner.slice(subListStart);
      } else {
        itemText = liInner;
      }

      itemText = itemText.replace(/<[^>]+>/g, '').trim();
      const marker = isOrdered ? `${liIndex + 1}.` : '-';
      const indent = '    '.repeat(depth);
      output += `${indent}${marker} ${itemText}\n`;

      if (subListHtml) {
        const isSubOrdered = subListHtml.trim().toLowerCase().startsWith('<ol');
        output += processListNode(subListHtml, depth + 1, isSubOrdered);
      }

      liIndex++;
    }
    return output;
  }

  md = md.replace(/<(ul|ol)\b[^>]*>(.*?)<\/\1>/gis, (match, tag) => {
    const isOrdered = tag.toLowerCase() === 'ol';
    return '\n\n' + processListNode(match, 0, isOrdered) + '\n';
  });

  // 4. Convert <p>...</p> and clean remaining HTML
  md = md.replace(/<p\b[^>]*>(.*?)<\/p>/gis, (_match, content) => {
    return '\n\n' + content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() + '\n\n';
  });
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/\\([-.\/*_{}\[\]()#+!])/g, '$1');

  return md;
};

export class DocxImporter extends TextDocumentImporter {
  id = 'docx';
  name = 'word (.docx)';
  fileExtensions = ['.docx'];
  isBinary = true;

  override defaultContentFormat: 'text' | 'markdown' = 'markdown';

  /**
   * Main entry point to parse a .docx document (ArrayBuffer or binary string) into a Tablord Table.
   */
  override async parse(content: string | ArrayBuffer): Promise<Table> {
    let arrayBuffer: ArrayBuffer;
    let buffer: any;

    if (content instanceof ArrayBuffer) {
      arrayBuffer = content;
      if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer) {
        buffer = (globalThis as any).Buffer.from(content);
      }
    } else if (typeof content === 'string') {
      if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer) {
        buffer = (globalThis as any).Buffer.from(content, 'binary');
        arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else {
        arrayBuffer = new TextEncoder().encode(content).buffer;
      }
    } else {
      throw new Error('Unsupported content type for DocxImporter');
    }

    const options: any = { arrayBuffer };
    if (buffer) {
      options.buffer = buffer;
    }

    const result = await mammoth.convertToHtml(options);
    const html = result.value || '';
    const md = convertDocxHtmlToMarkdown(html);

    return super.parse(md);
  }
}

export const docxImporter = new DocxImporter();

import mammoth from 'mammoth';
import type { Table } from '../types/document';
import { TextDocumentImporter } from './textDocumentImporter';

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

    const result = await mammoth.convertToMarkdown(options);
    let md = result.value || '';

    // Clean up mammoth markdown output:
    // 1. Remove HTML anchor tags
    md = md.replace(/<a\b[^>]*>(?:<\/a>)?/gi, '');
    // 2. Unescape common escaped punctuation (\- \. etc)
    md = md.replace(/\\([-.\/*_{}\[\]()#+!])/g, '$1');
    // 3. Clean heading titles wrapped in __ or **
    md = md.replace(/^(#{1,6}\s+)__(.*)__$/gm, '$1$2');
    md = md.replace(/^(#{1,6}\s+)\*\*(.*)\*\*$/gm, '$1$2');

    return super.parse(md);
  }
}

export const docxImporter = new DocxImporter();

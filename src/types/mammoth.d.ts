declare module 'mammoth' {
  export interface MammothOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: any;
    path?: string;
  }
  export interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToMarkdown(options: MammothOptions): Promise<MammothResult>;
  export function convertToHtml(options: MammothOptions): Promise<MammothResult>;
  export function extractRawText(options: MammothOptions): Promise<MammothResult>;
}

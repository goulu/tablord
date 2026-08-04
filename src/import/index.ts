import type { Importer } from './types';
import { markdownImporter } from './markdownImporter';
import { docxImporter, DocxImporter } from './docxImporter';

export type { Importer };
export { markdownImporter, docxImporter, DocxImporter };

export const availableImporters: Importer[] = [
  markdownImporter,
  docxImporter,
];


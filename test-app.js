import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`);
global.window = dom.window;
global.document = dom.window.document;
console.log("JSDOM ready. If this runs, we can run vitest.");

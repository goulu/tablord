import puppeteer from 'puppeteer';

(async () => {
  console.log('🚀 Launching Puppeteer E2E Test on Row 3...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-cell-id]');
  console.log('✅ Page loaded successfully');

  // Helper to click cell, clear text, and type new text
  const typeIntoCell = async (cellEl, text) => {
    await cellEl.click();
    await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(text);
    await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
  };

  const readRowCells = async () => {
    await page.click('body');
    await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    const cells = await page.$$('tr:nth-child(3) td');
    const texts = [];
    for (const cell of cells) {
      texts.push(await page.evaluate(el => el.textContent.trim(), cell));
    }
    return { cells, texts };
  };

  // Find cells from Row 3
  let { cells, texts: initTexts } = await readRowCells();
  console.log(`Initial values in Row 3 -> Cell 0: "${initTexts[0]}", Cell 1: "${initTexts[1]}", Cell 2: "${initTexts[2]}"`);

  // Cell 0: type Foo
  await typeIntoCell(cells[0], 'Foo');

  // Cell 1: type Bar
  await typeIntoCell(cells[1], 'Bar');

  // Cell 2: type Baz
  await typeIntoCell(cells[2], 'Baz');

  const { texts: editedTexts } = await readRowCells();
  console.log(`Edited values in Row 3 -> Cell 0: "${editedTexts[0]}", Cell 1: "${editedTexts[1]}", Cell 2: "${editedTexts[2]}"`);

  if (editedTexts[0] !== 'Foo' || editedTexts[1] !== 'Bar' || editedTexts[2] !== 'Baz') {
    console.error('❌ Typing failed!');
    process.exit(1);
  }

  // --- UNDO STEP 1 (should undo Cell 2 "Baz" -> initTexts[2]) ---
  console.log('--- Pressing Undo #1 (Ctrl+Z) ---');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  const { texts: u1Texts } = await readRowCells();
  console.log(`After Undo #1 -> Cell 0: "${u1Texts[0]}", Cell 1: "${u1Texts[1]}", Cell 2: "${u1Texts[2]}"`);

  // --- UNDO STEP 2 (should undo Cell 1 "Bar" -> initTexts[1]) ---
  console.log('--- Pressing Undo #2 (Ctrl+Z) ---');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  const { texts: u2Texts } = await readRowCells();
  console.log(`After Undo #2 -> Cell 0: "${u2Texts[0]}", Cell 1: "${u2Texts[1]}", Cell 2: "${u2Texts[2]}"`);

  // --- UNDO STEP 3 (should undo Cell 0 "Foo" -> initTexts[0]) ---
  console.log('--- Pressing Undo #3 (Ctrl+Z) ---');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  const { texts: u3Texts } = await readRowCells();
  console.log(`After Undo #3 -> Cell 0: "${u3Texts[0]}", Cell 1: "${u3Texts[1]}", Cell 2: "${u3Texts[2]}"`);

  // --- REDO STEP 1 (should redo Cell 0 "Foo") ---
  console.log('--- Pressing Redo #1 (Ctrl+Y) ---');
  await page.keyboard.down('Control');
  await page.keyboard.press('y');
  await page.keyboard.up('Control');
  const { texts: r1Texts } = await readRowCells();
  console.log(`After Redo #1 -> Cell 0: "${r1Texts[0]}", Cell 1: "${r1Texts[1]}", Cell 2: "${r1Texts[2]}"`);

  // --- REDO STEP 2 (should redo Cell 1 "Bar") ---
  console.log('--- Pressing Redo #2 (Ctrl+Y) ---');
  await page.keyboard.down('Control');
  await page.keyboard.press('y');
  await page.keyboard.up('Control');
  const { texts: r2Texts } = await readRowCells();
  console.log(`After Redo #2 -> Cell 0: "${r2Texts[0]}", Cell 1: "${r2Texts[1]}", Cell 2: "${r2Texts[2]}"`);

  // --- REDO STEP 3 (should redo Cell 2 "Baz") ---
  console.log('--- Pressing Redo #3 (Ctrl+Y) ---');
  await page.keyboard.down('Control');
  await page.keyboard.press('y');
  await page.keyboard.up('Control');
  const { texts: r3Texts } = await readRowCells();
  console.log(`After Redo #3 -> Cell 0: "${r3Texts[0]}", Cell 1: "${r3Texts[1]}", Cell 2: "${r3Texts[2]}"`);

  await browser.close();

  // Strict Assertions
  let failed = false;
  if (u1Texts[2] !== initTexts[2]) { console.error(`❌ Fail: Undo #1 failed! Cell 2 is "${u1Texts[2]}", expected "${initTexts[2]}"`); failed = true; }
  if (u1Texts[1] !== 'Bar') { console.error(`❌ Fail: Undo #1 altered Cell 1 to "${u1Texts[1]}"!`); failed = true; }
  if (u1Texts[0] !== 'Foo') { console.error(`❌ Fail: Undo #1 altered Cell 0 to "${u1Texts[0]}"!`); failed = true; }

  if (u2Texts[1] !== initTexts[1]) { console.error(`❌ Fail: Undo #2 failed! Cell 1 is "${u2Texts[1]}", expected "${initTexts[1]}"`); failed = true; }
  if (u2Texts[0] !== 'Foo') { console.error(`❌ Fail: Undo #2 altered Cell 0 to "${u2Texts[0]}"!`); failed = true; }

  if (u3Texts[0] !== initTexts[0]) { console.error(`❌ Fail: Undo #3 failed! Cell 0 is "${u3Texts[0]}", expected "${initTexts[0]}"`); failed = true; }

  if (r1Texts[0] !== 'Foo') { console.error(`❌ Fail: Redo #1 failed! Cell 0 is "${r1Texts[0]}", expected "Foo"`); failed = true; }
  if (r2Texts[1] !== 'Bar') { console.error(`❌ Fail: Redo #2 failed! Cell 1 is "${r2Texts[1]}", expected "Bar"`); failed = true; }
  if (r3Texts[2] !== 'Baz') { console.error(`❌ Fail: Redo #3 failed! Cell 2 is "${r3Texts[2]}", expected "Baz"`); failed = true; }

  if (failed) {
    console.error('❌ PUPPETEER E2E TEST FAILED!');
    process.exit(1);
  } else {
    console.log('🎉 PUPPETEER E2E TEST PASSED PERFECTLY!');
    process.exit(0);
  }
})();

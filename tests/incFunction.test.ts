import { describe, it, expect } from 'vitest';
import { incrementValue, incrementLetterSequence } from '../src/utils/functions';
import { evaluateFormula, recalculateTable } from '../src/utils/tableUtils';
import type { Table } from '../src/types/document';

describe('INC() function and value incrementation', () => {
  it('incrementLetterSequence increments single and multi-letter sequences preserving case', () => {
    expect(incrementLetterSequence('a')).toBe('b');
    expect(incrementLetterSequence('z')).toBe('aa');
    expect(incrementLetterSequence('A')).toBe('B');
    expect(incrementLetterSequence('Z')).toBe('AA');
    expect(incrementLetterSequence('az')).toBe('ba');
    expect(incrementLetterSequence('AZ')).toBe('BA');
    expect(incrementLetterSequence('zz')).toBe('aaa');
  });

  it('incrementValue correctly increments numbers, letters, and punctuation per user spec', () => {
    // 1 -> 2
    expect(incrementValue('1')).toBe('2');

    // A -> B
    expect(incrementValue('A')).toBe('B');

    // 11) -> 12)
    expect(incrementValue('11)')).toBe('12)');

    // Art. 12 -> Art. 13
    expect(incrementValue('Art. 12')).toBe('Art. 13');

    // Art. 112 - alinéa 14a -> Art. 112 - alinéa 14b (rightmost sequence)
    expect(incrementValue('Art. 112 - alinéa 14a')).toBe('Art. 112 - alinéa 14b');

    // Art. 112 - alinéa 14 -> Art. 112 - alinéa 15
    expect(incrementValue('Art. 112 - alinéa 14')).toBe('Art. 112 - alinéa 15');
  });

  it('returns #ERROR if target cell contains text but no incrementable sequence', () => {
    expect(incrementValue('---')).toBe('#ERROR');
    expect(incrementValue('!!!')).toBe('#ERROR');
  });

  it('evaluateFormula INC() evaluates correctly with valueMap', () => {
    const valueMap = {
      'A.1': '11)',
      'A.2': 'Art. 12',
      'A.3': 'Art. 112 - alinéa 14a',
      'A.4': '---',
      'A.5': '',
    };

    expect(evaluateFormula('=INC("A.1")', 'B.1', valueMap)).toBe('12)');
    expect(evaluateFormula('=INC("A.2")', 'B.2', valueMap)).toBe('Art. 13');
    expect(evaluateFormula('=INC("A.3")', 'B.3', valueMap)).toBe('Art. 112 - alinéa 14b');
    expect(evaluateFormula('=INC("A.4")', 'B.4', valueMap)).toBe('#ERROR');
    expect(evaluateFormula('=INC("A.5")', 'B.5', valueMap)).toBe('');
  });

  it('INC() with no args finds the first non-empty cell above it in same column', () => {
    const valueMap = {
      'A.1': 'Art. 10',
      'A.2': '',
      'A.3': '',
    };

    // Current cell is A.4, cell above with text is A.1 ("Art. 10")
    expect(evaluateFormula('=INC()', 'A.4', valueMap)).toBe('Art. 11');
  });

  it('INC() returns empty string if no cell above contains text', () => {
    const valueMap = {
      'A.1': '',
      'A.2': '',
    };

    expect(evaluateFormula('=INC()', 'A.3', valueMap)).toBe('');
  });

  it('recalculateTable propagates sequential INC() formulas correctly', () => {
    const table: Table = {
      id: 'document',
      columns: ['A'],
      rows: [
        { id: 'r1', cells: [{ id: 'c1', text: '1', className: 'text' }] },
        { id: 'r2', cells: [{ id: 'c2', text: '=INC()', className: 'formula' }] },
        { id: 'r3', cells: [{ id: 'c3', text: '=INC()', className: 'formula' }] },
        { id: 'r4', cells: [{ id: 'c4', text: '=INC()', className: 'formula' }] },
      ],
    };

    const evaluated = recalculateTable(table);
    expect(evaluated.rows[0].cells[0].value).toBeUndefined(); // text "1"
    expect(evaluated.rows[1].cells[0].value).toBe('2');
    expect(evaluated.rows[2].cells[0].value).toBe('3');
    expect(evaluated.rows[3].cells[0].value).toBe('4');
  });
});

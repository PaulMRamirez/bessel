import { describe, it, expect } from 'vitest';
import { seriesToCsv, intervalsToCsv } from './csv.ts';

describe('seriesToCsv', () => {
  it('writes a header and one row per sample', () => {
    const csv = seriesToCsv([0, 60, 120], [[10, 20, 30]], ['range_km']);
    expect(csv).toBe('et,range_km\n0,10\n60,20\n120,30\n');
  });

  it('uses epoch labels and multiple columns when given', () => {
    const csv = seriesToCsv(
      [0, 1],
      [
        [1, 2],
        [3, 4],
      ],
      ['a', 'b'],
      { epochHeader: 'utc', epochLabels: ['t0', 't1'] },
    );
    expect(csv).toBe('utc,a,b\nt0,1,3\nt1,2,4\n');
  });

  it('quotes fields containing commas', () => {
    const csv = seriesToCsv([0], [[1]], ['a,b']);
    expect(csv.split('\n')[0]).toBe('et,"a,b"');
  });

  it('neutralizes spreadsheet formula injection in text cells but not numbers', () => {
    // A malicious column name starting with "=" is prefixed with a quote; the numeric
    // data (including negatives) is untouched.
    const csv = seriesToCsv([0], [[-5]], ['=HYPERLINK("http://evil")']);
    const lines = csv.split('\n');
    expect(lines[0]).toContain(`'=HYPERLINK`);
    expect(lines[1]).toBe('0,-5'); // negative number kept as data, not escaped
  });
});

describe('intervalsToCsv', () => {
  it('writes start, stop, and duration per interval', () => {
    const csv = intervalsToCsv([
      [0, 100],
      [250, 300],
    ]);
    expect(csv).toBe('start,stop,duration_s\n0,100,100\n250,300,50\n');
  });

  it('formats epochs when a formatter is given', () => {
    const csv = intervalsToCsv([[0, 60]], { format: (v) => `e${v}` });
    expect(csv).toBe('start,stop,duration_s\ne0,e60,60\n');
  });
});

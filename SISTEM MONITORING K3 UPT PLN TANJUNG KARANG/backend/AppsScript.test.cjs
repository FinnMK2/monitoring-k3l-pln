const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, 'AppsScript.js'), 'utf8');
const clone = value => structuredClone(value);

function fixture({ extraNames = [], failReset = false, lockAvailable = true } = {}) {
  const sheets = [];
  let releases = 0;
  class Sheet {
    constructor(name, values, formulas = {}) {
      this.name = name;
      this.values = clone(values);
      this.formulas = { ...formulas };
      this.id = sheets.length + 1;
      sheets.push(this);
    }
    getName() { return this.name; }
    getSheetId() { return this.id; }
    setName(name) { this.name = name; return this; }
    getLastRow() { return this.values.length; }
    copyTo() {
      const copy = new Sheet('Copy of ' + this.name, this.values, this.formulas);
      copy.failReset = failReset;
      return copy;
    }
    getDataRange() { return this.getRange(1, 1, this.values.length, 71); }
    getRange(row, col, height = 1, width = 1) {
      if (this.failReset && row >= 17 && col === 14) throw new Error('Write failed');
      const sheet = this;
      const each = fn => {
        for (let r = row - 1; r < row - 1 + height; r++) {
          for (let c = col - 1; c < col - 1 + width; c++) fn(r, c);
        }
      };
      const matrix = fn => Array.from({ length: height }, (_, r) =>
        Array.from({ length: width }, (_, c) => fn(row - 1 + r, col - 1 + c)));
      const range = {
        getValues: () => matrix((r, c) => {
          if (sheet.formulas[`${r},${c}`]?.startsWith('=SUM(')) {
            return sheet.values[r].slice(13, 66).reduce((sum, v) => sum + Number(v || 0), 0);
          }
          return sheet.values[r]?.[c] ?? '';
        }),
        getFormulas: () => matrix((r, c) => sheet.formulas[`${r},${c}`] || ''),
        getRichTextValues: () => matrix(() => null),
        getFormula: () => sheet.formulas[`${row - 1},${col - 1}`] || '',
        clearContent: () => { each((r, c) => { sheet.values[r][c] = ''; delete sheet.formulas[`${r},${c}`]; }); return range; },
        setValue: value => { each((r, c) => { sheet.values[r][c] = value; delete sheet.formulas[`${r},${c}`]; }); return range; },
        setBackground: () => range,
        setNumberFormat: () => range,
        setHorizontalAlignment: () => range,
        setVerticalAlignment: () => range,
      };
      return range;
    }
  }
  const values = Array.from({ length: 20 }, () => Array(71).fill(''));
  for (const r of [16, 18]) {
    Object.assign(values[r], { 3: '1.1', 4: 'A', 5: 'Inspeksi', 6: 'PIC', 8: 4, 12: 'Plan', 13: 2, 14: 2 });
    Object.assign(values[r + 1], { 8: 3, 12: r === 16 ? 'Actual' : ' actual ', 13: 1, 14: 2 });
  }
  const original = new Sheet('Proker KAM 2026 TW 2', values, { '19,8': '=SUM(N20:BN20)' });
  for (const name of extraNames) new Sheet(name, values);
  const ss = {
    getSheets: () => [...sheets],
    getSheetByName: name => sheets.find(sheet => sheet.name === name) || null,
    deleteSheet: sheet => { sheets.splice(sheets.indexOf(sheet), 1); },
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock() { releases++; } }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }),
    },
  });
  vm.runInContext(source, context);
  const post = payload => context.doPost({ postData: { contents: JSON.stringify(payload) } });
  const get = params => context.doGet({ parameter: params });
  return { context, post, get, sheets, original, releases: () => releases };
}

test('list_years discovers existing tabs, deduplicates, and ignores partial year numbers', () => {
  const { get } = fixture({ extraNames: ['2027', 'Proker KAM 2027 TW 2', 'Proker KAM 2030', 'Log', 'Arsip 12028'] });
  assert.deepEqual(get({ action: 'list_years' }), { status: 'success', years: ['2026', '2027', '2030'] });
});

test('create_year persists a readable plan, resets actuals, preserves formulas and source', () => {
  const f = fixture();
  const before = clone(f.original.values);
  const result = f.post({ action: 'create_year', year: '2027', sourceYear: '2026' });
  assert.equal(result.status, 'success');
  assert.equal(result.created, true);
  assert.equal(result.sheetName, 'Proker KAM 2027');
  assert.deepEqual(result.years, ['2026', '2027']);
  assert.deepEqual(f.original.values, before);
  const copy = f.sheets.find(sheet => sheet.name === result.sheetName);
  assert.equal(copy.formulas['19,8'], '=SUM(N20:BN20)');
  assert.equal(copy.values[17][8], 0);
  assert.equal(copy.values[12][13], 'Januari 2027');
  const read = f.get({ action: 'read', year: '2027' });
  assert.equal(read.status, 'success');
  assert.equal(read.data.length, 2);
  for (const task of read.data) {
    assert.equal(task.target, 4);
    assert.deepEqual(task.weeks, { 1: 2, 2: 2 });
    assert.equal(task.actual, 0);
    assert.deepEqual(task.actualWeeks, {});
    assert.equal(task.status, 'Belum Mulai');
  }
  assert.equal(f.releases(), 1);
});

test('repeated create_year opens the existing year without copying or resetting it', () => {
  const f = fixture({ extraNames: ['2027'] });
  const before = clone(f.sheets[1].values);
  const result = f.post({ action: 'create_year', year: '2027', sourceYear: '2026' });
  assert.equal(result.status, 'success');
  assert.equal(result.created, false);
  assert.equal(f.sheets.length, 2);
  assert.deepEqual(f.sheets[1].values, before);
});

test('failed duplication rolls back only the newly copied tab and releases its lock', () => {
  const f = fixture({ failReset: true });
  const before = clone(f.original.values);
  const result = f.post({ action: 'create_year', year: '2027', sourceYear: '2026' });
  assert.equal(result.status, 'error');
  assert.match(result.message, /Write failed/);
  assert.equal(f.sheets.length, 1);
  assert.deepEqual(f.original.values, before);
  assert.equal(f.releases(), 1);
});

test('invalid years, missing source, and a busy lock never create a tab', () => {
  const f = fixture();
  for (const year of ['1999', '2101', '27', '2027x']) {
    assert.equal(f.post({ action: 'create_year', year }).status, 'error');
  }
  assert.equal(f.post({ action: 'create_year', year: '2027', sourceYear: '2025' }).status, 'error');
  assert.equal(f.sheets.length, 1);
  const busy = fixture({ lockAvailable: false });
  assert.equal(busy.post({ action: 'create_year', year: '2027' }).status, 'error');
  assert.equal(busy.sheets.length, 1);
  assert.equal(busy.releases(), 0);
});

test('reading a missing year never creates it', () => {
  const f = fixture();
  assert.equal(f.get({ action: 'read', year: '2027' }).status, 'error');
  assert.equal(f.sheets.length, 1);
});

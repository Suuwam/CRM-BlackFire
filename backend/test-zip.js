// node test-zip.js — the archive must open in a real unzip, byte for byte.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { zip } = require('./utils/zip');

const files = [{ name: 'activities.json', data: JSON.stringify([{ a: 1, s: 'नमस्ते ✓' }]) }, { name: 'README.txt', data: 'x'.repeat(50000) }];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
const file = path.join(dir, 'a.zip');
fs.writeFileSync(file, zip(files));
execFileSync('unzip', ['-tq', file]); // throws on any CRC or structure error
execFileSync('unzip', ['-q', file, '-d', path.join(dir, 'out')]);
for (const f of files) assert.strictEqual(fs.readFileSync(path.join(dir, 'out', f.name), 'utf8'), f.data);
fs.rmSync(dir, { recursive: true });
console.log('zip ok');

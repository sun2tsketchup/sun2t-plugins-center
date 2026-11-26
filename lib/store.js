// JSON file storage with atomic writes. Content lives in data/content.json,
// created from data/seed.json on first run.
const fs = require('fs');
const { migrate } = require('./migrate');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'content.json');
const SEED = path.join(__dirname, '..', 'data', 'seed.json');

let cache = null;

function writeAtomic(file, obj) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function load() {
  if (cache) return cache;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
    seed.rev = 1;
    writeAtomic(FILE, seed);
  }
  cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (migrate(cache)) {
    cache.rev = (cache.rev || 0) + 1;
    try { fs.copyFileSync(FILE, FILE + '.bak'); } catch (_) {}
    writeAtomic(FILE, cache);
  }
  return cache;
}

function save(mutator) {
  const data = load();
  mutator(data);
  data.rev = (data.rev || 0) + 1;
  data.updatedAt = new Date().toISOString();
  // keep a rolling backup of the previous version
  try { fs.copyFileSync(FILE, FILE + '.bak'); } catch (_) {}
  writeAtomic(FILE, data);
  return data;
}

module.exports = { load, save, writeAtomic, DATA_DIR };

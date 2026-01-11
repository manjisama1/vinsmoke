import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = 'https://github.com/manjisama1/vinsmoke.git';
const C = { res: '\x1b[0m', g: '\x1b[90m', c: '\x1b[36m', gr: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m' };
const TS = () => new Date().toTimeString().slice(0, 8);

const logger = {
  log: (lvl, col, msg, data = '') => console.log(`${C.g}${TS()}${C.res} ${col}[${lvl}]${C.res} ${msg}${data ? ` ${C.g}${data}${C.res}` : ''}`),
  info: (m, d) => logger.log('INFO', C.c, m, d),
  success: (m, d) => logger.log('SUCCESS', C.gr, m, d),
  error: (m, d) => logger.log('ERROR', C.r, m, d)
};

const has = (cmd) => {
  try { 
    execSync(os.platform() === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' }); 
    return true; 
  } catch { return false; }
};

const stream = (cmd, args) => new Promise(res => {
  const isWin = os.platform() === 'win32';
  const p = spawn(cmd, args, { stdio: 'inherit', shell: isWin, windowsVerbatimArguments: isWin });
  p.on('close', code => res(code === 0));
});

const setupRepo = async () => {
  if (fs.existsSync('.git')) return logger.success('Repository verified'), true;
  const isEmpty = fs.readdirSync('.').filter(f => !f.startsWith('.')).length === 0;
  if (isEmpty) return await stream('git', ['clone', REPO, '.']);

  logger.info('Merging remote repository...');
  const tmp = `v_tmp_${Date.now()}`;
  if (!await stream('git', ['clone', REPO, tmp])) return false;

  for (const f of fs.readdirSync(tmp)) {
    const src = path.join(tmp, f), dest = path.join(process.cwd(), f);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return true;
};

const cleanStart = async () => {
  const isGlobal = has('pm2');
  const bin = isGlobal ? 'pm2' : 'npx';
  const baseArgs = isGlobal ? [] : ['pm2'];
  try { execSync(`${isGlobal ? '' : 'npx '}pm2 delete vinsmoke`, { stdio: 'ignore' }); } catch {}
  logger.info(`Launching via ${bin.toUpperCase()}...`);
  await stream(bin, [...baseArgs, 'start', 'index.js', '--name', 'vinsmoke', '--attach']);
};

(async () => {
  console.clear();
  if (!has('git') || !has('ffmpeg')) return logger.error('Missing Git or FFmpeg'), process.exit(1);
  if (!await setupRepo()) return logger.error('Repo setup failed'), process.exit(1);

  if (!fs.existsSync('config.env')) {
    const cfg = `# --- SESSION CONFIG ---
SESSION_ID=null
QR=true
BOT_NUM=null

# --- BOT SETTINGS ---
PREFIX=.
BOT_MODE=private
BOT_LANG=en
TIMEZONE=Asia/Kolkata

# --- AUTOMATION ---
AUTO_READ=false
AUTO_STATUS_READ=false
ALWAYS_ONLINE=false

# --- CUSTOMIZATION ---
REACT=⌛
STICKER_PACK=manji • •,• 💗
WARN=3
SUDO=null
ADMIN_VALUE=false`;
    fs.writeFileSync('config.env', cfg);
    logger.success('Config generated (clean structure)');
  }

  logger.info('Syncing dependencies...');
  if (!await stream('npm', ['install', '--no-audit', '--no-fund'])) return logger.error('Install failed'), process.exit(1);
  await cleanStart();
})();
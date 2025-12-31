import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);
const time = () => new Date().toTimeString().slice(0, 12);
const c = { g: '\x1b[90m', c: '\x1b[36m', gr: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', x: '\x1b[0m' };

const log = {
  i: m => console.log(`${c.g}${time()}${c.x} ${c.c}[INFO]${c.x} ${m}`),
  s: m => console.log(`${c.g}${time()}${c.x} ${c.gr}[SUCCESS]${c.x} ${m}`),
  w: m => console.log(`${c.g}${time()}${c.x} ${c.y}[WARN]${c.x} ${m}`),
  e: m => console.log(`${c.g}${time()}${c.x} ${c.r}[ERROR]${c.x} ${m}`)
};

const run = async cmd => {
  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 });
    return { ok: true, out: stdout.trim() };
  } catch (e) {
    return { ok: false, out: e?.stdout ? String(e.stdout).trim() : null };
  }
};

const stream = (cmd, args) => new Promise(resolve => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true });
  p.on('close', code => resolve(code === 0));
  p.on('error', () => resolve(false));
});

const isTermux = () => Boolean(process.env.TERMUX_VERSION || process.env.ANDROID_ROOT || os.platform() === 'android');

const check = async (cmd, install, name) => {
  log.i(`Checking ${name || cmd}...`);
  const ok = await run(cmd);
  
  if (ok.ok) {
    log.s(`${name || cmd}: ${ok.out}`);
    return true;
  }
  
  if (!install) {
    log.w(`${name || cmd} not found`);
    return false;
  }
  
  const platform = os.platform();
  if (!['linux', 'darwin'].includes(platform)) {
    log.w(`${name || cmd} not found on ${platform}`);
    return false;
  }
  
  log.w(`${name || cmd} not found, installing...`);
  const installed = await stream('sh', ['-c', install]);
  
  if (installed) {
    log.s(`${name || cmd} installed`);
    return true;
  }
  
  log.w(`Install failed for ${name || cmd}`);
  return false;
};

const ensureNode = async () => {
  const res = await run('node -v');
  if (!res.ok) {
    log.e('Node.js not found');
    return false;
  }
  
  const major = parseInt(res.out.replace(/^v/, '').split('.')[0], 10);
  if (isNaN(major) || major < 20) {
    log.e(`Node.js ${res.out} detected. Requires 20+`);
    return false;
  }
  
  log.s(`Node.js ${res.out}`);
  return true;
};

const ensureGit = () => check('git --version', 'apt-get update -y && apt-get install -y git', 'git');

const ensureFfmpeg = async () => {
  const res = await run('ffmpeg -version');
  if (!res.ok) {
    log.w('ffmpeg not found');
    return false;
  }
  
  const version = res.out.split('\n')[0].match(/ffmpeg version ([\d.]+)/)?.[1] || 'unknown';
  log.s(`ffmpeg ${version}`);
  return true;
};

const ensurePm2 = async () => {
  const ok = await run('pm2 -v');
  if (ok.ok) {
    log.s(`PM2 ${ok.out}`);
    return true;
  }
  
  log.w('PM2 not found, installing locally...');
  const installed = await stream('npm', ['install', 'pm2', '--no-fund', '--no-audit']);
  
  if (!installed) {
    log.w('PM2 not available');
    return false;
  }
  
  const check = await run('npx pm2 -v');
  if (check.ok) {
    log.s(`PM2 ${check.out} (npx)`);
    return true;
  }
  
  log.w('PM2 not available');
  return false;
};

const cloneRepo = async () => {
  const repo = 'https://github.com/manjisama1/vinsmoke.git';
  const isGitRepo = await run('git rev-parse --is-inside-work-tree');
  
  if (isGitRepo.ok) {
    log.i('Already in git repository, verifying remote...');
    const remoteCheck = await run('git remote get-url origin');
    
    if (remoteCheck.ok && remoteCheck.out === repo) {
      log.s('Git repository verified');
      return true;
    }
    
    if (remoteCheck.ok) {
      log.w(`Different remote detected: ${remoteCheck.out}`);
      const updateRemote = await run(`git remote set-url origin ${repo}`);
      if (updateRemote.ok) {
        log.s('Remote updated');
        return true;
      }
    } else {
      const addRemote = await run(`git remote add origin ${repo}`);
      if (addRemote.ok) {
        log.s('Remote added');
        return true;
      }
    }
    
    log.w('Remote setup failed, continuing...');
    return true;
  }

  const isEmpty = fs.readdirSync('.').length === 0;
  if (isEmpty) {
    log.i('Cloning to empty directory...');
    const cloneOk = await stream('git', ['clone', repo, '.']);
    if (!cloneOk) {
      log.e('Clone failed');
      return false;
    }
    log.s('Repository cloned');
    return true;
  }

  log.i('Directory not empty, cloning to temp and moving...');
  const tempDir = 'temp_clone_' + Date.now();
  
  const cloneOk = await stream('git', ['clone', repo, tempDir]);
  if (!cloneOk) {
    log.e('Clone to temp directory failed');
    return false;
  }

  const win = process.platform === 'win32';
  const moveCmd = win 
    ? `xcopy "${tempDir}\\*" . /E /I /H /Y >nul 2>&1 && rmdir /S /Q "${tempDir}"`
    : `cp -rf "${tempDir}"/. . && rm -rf "${tempDir}"`;

  const moveOk = await run(moveCmd);
  if (!moveOk.ok) {
    log.e('Failed to move files from temp directory');
    await run(win ? `rmdir /S /Q "${tempDir}"` : `rm -rf "${tempDir}"`);
    return false;
  }

  log.s('Repository cloned and moved successfully');
  return true;
};

const ensureConfig = () => {
  if (fs.existsSync('config.env')) {
    log.s('config.env exists');
    return;
  }
  
  log.w('config.env not found, creating...');
  
  if (fs.existsSync('config.env.example')) {
    try {
      fs.copyFileSync('config.env.example', 'config.env');
      log.s('Copied from example');
      return;
    } catch (e) {
      log.w(`Copy failed: ${e.message}`);
    }
  }
  
  fs.writeFileSync('config.env', `SESSION=null
PREFIX=.
REACT=💛
STICKER_PACK=manji,𝐕𝐈𝐍𝐒𝐌𝐎𝐊_E
BOT_MODE=private
SUDO=null
QR=true
BOT_NUM=null
WARN=2
TIMEZONE=Asia/Kolkata
BOT_LANG=en
AUTO_READ=false
AUTO_STATUS_READ=false
ALWAYS_ONLINE=false
DELETE=true
DATABASE_URL=null
`);
  log.s('Default config.env created');
};

const installDeps = async () => {
  const termux = isTermux();
  
  if (!fs.existsSync('package.json')) {
    log.e('package.json missing');
    return false;
  }

  log.i('Checking dependencies...');
  const check = await run('npm list --depth=0 --json');
  
  if (check.ok) {
    try {
      const data = JSON.parse(check.out);
      if (data.dependencies && Object.keys(data.dependencies).length > 0) {
        log.s('Dependencies verified');
        return true;
      }
    } catch {}
  }

  const pkgPath = path.join(process.cwd(), 'package.json');
  let pkg;
  
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    log.e(`Failed to read package.json: ${e.message}`);
    return false;
  }

  const needsPatch = termux && (pkg.dependencies?.sharp || pkg.optionalDependencies?.sharp);
  const backup = pkgPath + '.bak';

  if (needsPatch) {
    log.w('Termux: removing sharp temporarily');
    fs.writeFileSync(backup, JSON.stringify(pkg, null, 2));
    const patched = JSON.parse(JSON.stringify(pkg));
    if (patched.dependencies?.sharp) delete patched.dependencies.sharp;
    if (patched.optionalDependencies?.sharp) delete patched.optionalDependencies.sharp;
    if (patched.devDependencies?.sharp) delete patched.devDependencies.sharp;
    fs.writeFileSync(pkgPath, JSON.stringify(patched, null, 2));
  }

  if (termux) {
    process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = '1';
    process.env.npm_config_sharp_skip_binary_download = 'true';
    process.env.npm_config_build_from_source = 'false';
  }

  log.i('Installing dependencies...');
  const installed = await stream('npm', ['install', '--no-audit', '--no-fund', '--silent']);
  
  if (!installed) {
    log.e('npm install failed');
    if (needsPatch) {
      try {
        fs.copyFileSync(backup, pkgPath);
        fs.unlinkSync(backup);
      } catch {}
    }
    return false;
  }

  if (needsPatch) {
    try {
      fs.copyFileSync(backup, pkgPath);
      fs.unlinkSync(backup);
      log.s('Restored package.json');
    } catch (e) {
      log.w(`Restore failed: ${e.message}`);
    }
  }

  log.s('Dependencies installed');
  return true;
};

const start = async () => {
  const havePm2 = (await run('pm2 -v')).ok;
  const launcher = havePm2 ? 'pm2' : 'npx';
  const args = havePm2 
    ? ['start', '.', '--attach', '--name', 'vinsmoke', '--silent'] 
    : ['pm2', 'start', '.', '--attach', '--name', 'vinsmoke', '--silent'];
  
  log.i(`Starting via ${launcher}...`);
  const ok = await stream(launcher, args);
  
  if (ok) return true;
  
  log.w('PM2 failed, trying node fallback');
  
  if (!fs.existsSync('index.js')) {
    log.e('No index.js found');
    return false;
  }
  
  await stream('node', ['index.js']);
  return true;
};

const main = async () => {
  log.i('vinsmoke installer starting');

  if (!await ensureNode()) process.exit(1);
  
  await ensureFfmpeg();
  await ensureGit();

  const repo = await cloneRepo();
  if (!repo) log.w('Clone failed, continuing...');

  ensureConfig();
  await ensurePm2();

  const deps = await installDeps();
  if (!deps) process.exit(1);

  log.s('All checks passed');
  
  const started = await start();
  if (!started) {
    log.e('Start failed');
    process.exit(1);
  }

  setInterval(() => {}, 1000 * 60 * 60);
  log.s('Boot complete');
};

main();
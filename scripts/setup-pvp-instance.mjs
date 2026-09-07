import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

console.log('=== Setting up Dedicated MLUltimate PvP 1.8.9 Instance ===');

const appData = process.env.APPDATA;
const launcherRoot = path.join(appData, 'MLUltimate Launcher');
const instancesRoot = path.join(launcherRoot, 'Instances');
const dataDir = path.join(launcherRoot, 'Data');
const dbPath = path.join(dataDir, 'mlultimate.sqlite');

const instanceId = 'mlultimate-pvp-1.8.9';
const instanceName = 'MLUltimate PvP 1.8.9';
const instanceGameDir = path.join(instancesRoot, instanceId);
const modsDir = path.join(instanceGameDir, 'mods');

// Source mod jar
const builtClientMod = path.join(process.cwd(), 'dist-mod', 'MLUltimate-Client-1.8.9.jar');
const builtPvpMod = path.join(process.cwd(), 'dist-mod', 'MLUltimate-PvP-1.8.9.jar');
const builtMod = fs.existsSync(builtClientMod) ? builtClientMod : builtPvpMod;

if (!fs.existsSync(builtMod)) {
  console.error('Built mod not found at:', builtMod);
  process.exit(1);
}

// 1. Prepare directory structure
fs.mkdirSync(instanceGameDir, { recursive: true });
fs.mkdirSync(modsDir, { recursive: true });
fs.mkdirSync(path.join(instanceGameDir, 'config'), { recursive: true });
fs.mkdirSync(path.join(instanceGameDir, 'resourcepacks'), { recursive: true });
fs.mkdirSync(path.join(instanceGameDir, 'shaderpacks'), { recursive: true });

// 2. Clean legacy conflicting jars in mods dir (preserve MLUltimate-Client and OptiFine)
for (const file of fs.readdirSync(modsDir)) {
  if (file.endsWith('.jar') && file !== 'MLUltimate-Client-1.8.9.jar' && !file.toLowerCase().includes('optifine')) {
    console.log('Removing old/conflicting mod:', file);
    fs.unlinkSync(path.join(modsDir, file));
  }
}

// 3. Copy our all-in-one mod into mods directory
const targetModPath = path.join(modsDir, 'MLUltimate-Client-1.8.9.jar');
fs.copyFileSync(builtMod, targetModPath);
console.log('Copied MLUltimate-Client-1.8.9.jar to:', targetModPath);

// Copy OptiFine 1.8.9 into instance mods directory
const optifineSource = path.join(process.cwd(), 'dist-mod', 'OptiFine_1.8.9_HD_U_M5.jar');
if (fs.existsSync(optifineSource)) {
  const targetOptifine = path.join(modsDir, 'OptiFine_1.8.9_HD_U_M5.jar');
  fs.copyFileSync(optifineSource, targetOptifine);
  console.log('Copied OptiFine_1.8.9_HD_U_M5.jar to:', targetOptifine);
}

// Also copy to libraries cache for launcher-wide access
const pvpLibDir = path.join(launcherRoot, 'Minecraft', 'libraries', 'net', 'mlultimate', 'client', '1.8.9');
fs.mkdirSync(pvpLibDir, { recursive: true });
fs.copyFileSync(builtMod, path.join(pvpLibDir, 'MLUltimate-Client-1.8.9.jar'));

// Java 8 path
const java8Path = 'C:\\Program Files (x86)\\Common Files\\Oracle\\Java\\java8path\\javaw.exe';
const hasJava8 = fs.existsSync(java8Path);

// 4. Update SQLite database
const SQL = await initSqlJs();
const dbBuffer = fs.readFileSync(dbPath);
const db = new SQL.Database(dbBuffer);

const now = new Date().toISOString();

// Check if instance exists
const checkRes = db.exec(`SELECT id FROM instances WHERE id = '${instanceId}'`);
const exists = checkRes.length > 0 && checkRes[0].values.length > 0;

if (exists) {
  console.log('Updating existing instance in database...');
  db.run(`
    UPDATE instances SET
      name = ?,
      minecraft_version = ?,
      loader = ?,
      loader_version = ?,
      ram_mb = ?,
      java_path = ?,
      game_dir = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    instanceName,
    '1.8.9',
    'forge',
    '11.15.0.1656',
    4096,
    hasJava8 ? java8Path : null,
    instanceGameDir,
    now,
    instanceId
  ]);
} else {
  console.log('Inserting new dedicated instance in database...');
  db.run(`
    INSERT INTO instances (
      id, name, minecraft_version, loader, loader_version, ram_mb, java_path, game_dir, icon_path, content_management_enabled, auto_update_modpack, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    instanceId,
    instanceName,
    '1.8.9',
    'forge',
    '11.15.0.1656',
    4096,
    hasJava8 ? java8Path : null,
    instanceGameDir,
    null,
    1,
    0,
    now,
    now
  ]);
}

const exported = db.export();
fs.writeFileSync(dbPath, Buffer.from(exported));
console.log('Database successfully saved with dedicated PvP instance!');

// Also verify instance in database
const verifyRes = db.exec(`SELECT id, name, minecraft_version, loader, loader_version, game_dir FROM instances WHERE id = '${instanceId}'`);
console.log('Verified instance:', JSON.stringify(verifyRes, null, 2));

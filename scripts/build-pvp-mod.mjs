import fs from 'fs';
import path from 'path';
import cp from 'child_process';

const projectRoot = process.cwd();
const clientDir = path.join(projectRoot, 'client-1.8.9');
const srcDir = path.join(clientDir, 'src', 'main', 'java');
const resDir = path.join(clientDir, 'src', 'main', 'resources');
const buildDir = path.join(clientDir, 'build');
const classesDir = path.join(buildDir, 'classes');
const distDir = path.join(projectRoot, 'dist-mod');
const outputJar = path.join(distDir, 'MLUltimate-Client-1.8.9.jar');
const legacyOutputJar = path.join(distDir, 'MLUltimate-PvP-1.8.9.jar');

console.log('=== Building MLUltimate Client 1.8.9 Mod ===');

// Clean & prepare dirs
if (!fs.existsSync(classesDir)) fs.mkdirSync(classesDir, { recursive: true });
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

function walk(dir, ext = '.java') {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      res.push(...walk(full, ext));
    } else if (f.endsWith(ext)) {
      res.push(full);
    }
  }
  return res;
}

const javaFiles = walk(srcDir, '.java').filter(f => !f.replace(/\\/g, '/').includes('/mixin/'));
console.log(`Found ${javaFiles.length} Java source files (excluding legacy mixins).`);

const libs = [
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'versions', '1.8.9', '1.8.9.jar'),
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'libraries', 'net', 'minecraftforge', 'forge', '1.8.9-11.15.0.1656', 'forge-1.8.9-11.15.0.1656.jar'),
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'libraries', 'org', 'lwjgl', 'lwjgl', 'lwjgl', '2.9.4-nightly-20150209', 'lwjgl-2.9.4-nightly-20150209.jar'),
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'libraries', 'org', 'lwjgl', 'lwjgl', 'lwjgl_util', '2.9.0', 'lwjgl_util-2.9.0.jar'),
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'libraries', 'net', 'minecraft', 'launchwrapper', '1.12', 'launchwrapper-1.12.jar'),
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'libraries', 'com', 'google', 'code', 'gson', 'gson', '2.10', 'gson-2.10.jar'),
  path.join(process.env.APPDATA, 'MLUltimate Launcher', 'Minecraft', 'libraries', 'com', 'google', 'guava', 'guava', '17.0', 'guava-17.0.jar')
];

for (const lib of libs) {
  if (!fs.existsSync(lib)) {
    console.error('Missing library:', lib);
    process.exit(1);
  }
}

const cpString = libs.join(';');
const sourcesFile = path.join(buildDir, 'sources.txt');
fs.writeFileSync(sourcesFile, javaFiles.map(f => `"${f.replace(/\\/g, '/')}"`).join('\n'), 'utf8');

// Wipe old classes directory to ensure no stale mixin classes linger
if (fs.existsSync(classesDir)) {
  fs.rmSync(classesDir, { recursive: true, force: true });
}
fs.mkdirSync(classesDir, { recursive: true });

console.log('Compiling Java classes with javac (--release 8)...');
cp.execFileSync('javac', [
  '--release', '8',
  '-proc:none',
  '-encoding', 'UTF-8',
  '-cp', cpString,
  '-d', classesDir,
  '@' + sourcesFile
], { stdio: 'inherit' });

console.log('Copying resources into build output...');
function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    if (item.includes('mixin')) continue; // Skip mixin json
    const s = path.join(src, item);
    const d = path.join(dst, item);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}
copyRecursive(resDir, classesDir);

// Create Manifest for pure Forge mod
const manifestContent = [
  'Manifest-Version: 1.0',
  'Created-By: MLUltimate Build System',
  ''
].join('\r\n');
const manifestFile = path.join(buildDir, 'MANIFEST.MF');
fs.writeFileSync(manifestFile, manifestContent, 'utf8');

console.log('Packaging JAR with jar tool...');
if (fs.existsSync(outputJar)) fs.unlinkSync(outputJar);

cp.execFileSync('jar', [
  'cfm',
  outputJar,
  manifestFile,
  '-C', classesDir,
  '.'
], { stdio: 'inherit' });

fs.copyFileSync(outputJar, legacyOutputJar);

console.log('Mod successfully built:');
console.log(`Path: ${outputJar}`);
console.log(`Size: ${(fs.statSync(outputJar).size / 1024).toFixed(1)} KB`);

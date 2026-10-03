'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = __dirname;
const publicDir = path.join(root, 'public');

function fail(message) {
  console.error('SMOKE TEST FAILED:', message);
  process.exit(1);
}

function runCheck(file) {
  const result = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    fail(`${file} has a syntax error.`);
  }
}

['server.js', 'db.js', 'public/script.js', 'push.js'].forEach(file => {
  runCheck(path.join(root, file));
});

const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'style-v3-overrides.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const sw = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
const jsRefs = [...script.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(m => m[1]);
const missing = [...new Set(jsRefs)].filter(id => !ids.has(id));
if (missing.length) fail(`Missing HTML ids: ${missing.join(', ')}`);

if (!html.includes('style-v3-overrides.css?v=4')) fail('V3 CSS cache-buster missing.');
if (!html.includes('script.js?v=4')) fail('JS cache-buster missing.');
if (!css.includes('.hidden { display:none !important; }')) fail('Shared hidden rule missing.');
if (!css.includes('.call-overlay { display:grid; place-items:center; }')) fail('Call overlay must not override .hidden with !important.');
if (css.includes('.call-overlay { display:grid !important;')) fail('Broken call overlay display !important rule is still present.');
if (!css.includes('#wavelengthDarkModeToggle { display:block !important; }')) fail('Homepage dark-mode control is still hidden by legacy CSS.');
if (!css.includes('#contactsSection { display:block !important; }')) fail('Homepage saved contacts are still hidden by legacy CSS.');

if (!server.includes("fromName: String(names.get(ws) || 'Stranger')")) fail('Incoming calls do not use the caller profile from the server.');
if (!server.includes('if (!(await db.areContacts(myId, toId))) break;')) fail('Inbox contact authorization checks are missing.');
if (!server.includes("payload.read = recipientHasThreadOpen;")) fail('Live read receipts are not marked on immediate delivery.');
if (!sw.includes("openWindow(chatId ? '/?chat='+encodeURIComponent(chatId) : '/')")) fail('Push notification deep-link behavior is missing.');
if (!script.includes('new URLSearchParams(location.search).get(\'chat\')')) fail('Fresh-tab push notification deep link is not restored.');

const avatarDir = path.join(publicDir, 'avatars');
const avatarFiles = fs.existsSync(avatarDir)
  ? fs.readdirSync(avatarDir).filter(name => /^\w+\.jpg$/i.test(name))
  : [];
if (avatarFiles.length < 10) fail(`Expected 10 bundled avatars, found ${avatarFiles.length}.`);

console.log('Wavelength smoke tests passed.');
console.log(`HTML ids: ${ids.size}`);
console.log(`JS getElementById refs: ${new Set(jsRefs).size}`);
console.log(`Bundled avatars: ${avatarFiles.length}`);

/**
 * Verify the exact static directory before uploading HISAAB to an independent host.
 *   node scripts/hisaab-verify-artifact.mjs dist-hisaab-domain [--base=/]
 * For the parallel Pages release use --base=/fact-duel/hisaab/.
 * This checks packaging, not browser behavior, connection reliability, or server capacity.
 */
import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const directory = args.find(arg => !arg.startsWith('--'));
assert.ok(directory, 'Provide the built static directory; never upload the source repository.');
assert.ok(args.every(arg => arg === directory || arg.startsWith('--base=')), 'Unknown option. Use --base=/ or --base=/fact-duel/hisaab/.');
const base = args.find(arg => arg.startsWith('--base='))?.slice(7) ?? '/';
assert.match(base, /^\/(?:[^?#\\]+\/)?$/, 'Base must be an absolute URL path ending in /.');
assert.ok(!base.split('/').some(part => part === '.' || part === '..'), 'Base must not contain dot segments.');
const root = path.resolve(directory);
const origin = 'https://hisaab-artifact.invalid';
const rootUrl = origin + base;
let files = 0;
let localReferences = 0;
let bytes = 0;
const textFiles = [];
const required = ['index.html', 'manifest.webmanifest', 'favicon.svg', 'about.html', 'privacy.html', 'contact.html', 'publication.css', 'downloads/hisaab-money-ledger.csv', 'downloads/hisaab-money-ledger.xlsx'];

function requireFile(relative, source = 'release') {
  const absolute = path.resolve(root, relative);
  assert.ok(absolute.startsWith(root + path.sep), `${source}: reference escapes the artifact directory.`);
  let entry;
  try { entry = lstatSync(absolute); } catch { assert.fail(`${source}: missing ${relative}`); }
  assert.ok(entry.isFile(), `${source}: expected regular file ${relative}`);
  assert.ok(entry.size > 0, `${source}: empty ${relative}`);
  return absolute;
}

function localReference(value, source, { localOnly = false } = {}) {
  if (!value || value.startsWith('#') || /^(?:data|blob|mailto|tel):/i.test(value)) return;
  const url = new URL(value.replaceAll('&amp;', '&'), new URL(source, rootUrl));
  if (url.origin !== origin) {
    assert.ok(!localOnly, `${source}: runtime asset must be bundled locally.`);
    return;
  }
  assert.ok(url.pathname.startsWith(base), `${source}: ${url.pathname} is outside configured base ${base}`);
  let relative = decodeURIComponent(url.pathname.slice(base.length));
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  requireFile(relative, source);
  localReferences++;
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    assert.ok(!entry.isSymbolicLink(), `Do not publish symlink ${relative}.`);
    assert.ok(!/^(?:\.git|\.env(?:\..*)?|node_modules|upload|server|supabase)$/i.test(entry.name), `Private/source path in static artifact: ${relative}`);
    assert.ok(!/^(?:gittoken.*|.*\.pem|.*\.key|wrangler.*|package\.json|pnpm-lock\.yaml|.*\.map)$/i.test(entry.name), `Private/source file in static artifact: ${relative}`);
    if (entry.isDirectory()) { walk(absolute); continue; }
    assert.ok(entry.isFile(), `Unsupported file type: ${relative}`);
    files++; bytes += statSync(absolute).size;
    if (/\.(?:html|css|js|mjs|json|webmanifest|txt|csv|svg)$/i.test(entry.name)) {
      const text = readFileSync(absolute, 'utf8');
      // Never print a matching value: a failure identifies the file only.
      assert.ok(!/(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text), `Possible private credential in ${relative}; value withheld.`);
      textFiles.push({ relative, text });
    }
  }
}

for (const relative of required) requireFile(relative);
walk(root);
const index = readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /Andhbhakt ya Deshbhakt/, 'Wrong game artifact: Andhbhakt ya Deshbhakt title missing.');
requireFile('social-card.png');
assert.match(index, /https:\/\/occult-kranti\.github\.io\/andhbhakt-ya-deshbhakt\//, 'Standalone publication URL missing.');
assert.match(index, /<script\b[^>]*type=["']module["'][^>]*src=/, 'Production module entry missing.');
assert.doesNotMatch(index, /(?:src|href)=["'][^"']*\.(?:tsx?|jsx)(?:[?#"'])/, 'Unbuilt source entry in artifact.');
assert.doesNotMatch(index, /<script\b[^>]*src=["'][^"']*(?:googlesyndication|doubleclick)/i, 'Ad script must be gated at runtime, never loaded by the document.');

for (const { relative, text } of textFiles) {
  if (relative.endsWith('.html')) {
    for (const tag of text.matchAll(/<(?:a|link|script|img|source)\b[^>]*>/gi)) {
      const ref = tag[0].match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
      if (ref) localReference(ref, relative, { localOnly: /^<(?:script|img|source)\b/i.test(tag[0]) || /\brel=["'](?:stylesheet|icon|manifest|modulepreload)["']/i.test(tag[0]) });
    }
  } else if (relative.endsWith('.css')) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) localReference(match[1], relative, { localOnly: true });
  }
}
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.short_name, 'AYD', 'Wrong manifest brand.');
assert.match(manifest.name, /^Andhbhakt ya Deshbhakt/, 'Wrong full manifest brand.');
assert.equal(new URL(manifest.start_url, rootUrl).href, rootUrl, 'Manifest start_url must resolve to this release root.');
assert.equal(new URL(manifest.scope, rootUrl).href, rootUrl, 'Manifest scope must resolve to this release root.');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length, 'Manifest needs a bundled icon.');
for (const icon of manifest.icons) localReference(icon.src, 'manifest.webmanifest', { localOnly: true });

console.log(JSON.stringify({ ok: true, directory: root, base, files, localReferences, bytes, note: 'Static packaging verified. Browser flows and real-network friend connectivity require separate checks.' }, null, 2));

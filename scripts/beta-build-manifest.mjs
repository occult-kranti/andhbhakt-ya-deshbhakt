import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const directory = process.argv[2];
if (!directory || !fs.existsSync(path.join(directory, 'index.html'))) throw new Error('A built site directory is required.');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
fs.writeFileSync(path.join(directory, 'release.json'), JSON.stringify({commit, builtAt:new Date().toISOString(), game:'Andhbhakt ya Deshbhakt', transport:'Supabase human duels', adsEnabled:false}, null, 2)+'\n');

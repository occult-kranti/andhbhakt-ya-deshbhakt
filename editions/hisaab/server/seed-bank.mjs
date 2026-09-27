// Rebuild the privileged seed from the same audited editorial bank used in practice.
// These are public learning questions, not an anti-cheat secret corpus.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK } from '../bank/index.mjs';
// Existing reviewed ownership items only; no new editorial assertions are introduced.
const ownershipIds = new Set(['hmd001','hmd002','hmd003','hmd004','hmd005','hmd006','hmd007','hmd008','hmd009','hmd010','hmd011','hmd012','hmd021','hmd034','hmd035','hmd036','hmd037','hmd038','hmd039','hmd040']);
const rows = BANK.filter(q => q.options?.length === 4 && Number.isInteger(q.correctIndex)).map(q => ({
  id:q.id,prompt:{en:q.question,hi:q.questionHi || q.question},
  options:q.options.map((text,i) => ({en:text,hi:q.optionsHi?.[i] || text})),
  category:q.topic || q.kind,correctIndex:q.correctIndex,
  files:[...(q.topic === 'Welfare & Subsidies' || q.tags?.includes('distribution') ? ['subsidies'] : []), ...(q.tags?.includes('pre-election') ? ['pre-election'] : []), ...(ownershipIds.has(q.id) ? ['media'] : [])],
  explanation:{en:q.explanation,hi:q.explanationHi || q.explanation},sourceUrl:q.sourceUrl,
}));
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/hisaab/seed-bank.sql');
const sql = "-- Generated from the existing reviewed HISAAB bank; do not expose this table.\ninsert into hisaab_private.questions(id,payload) select item->>'id',item from jsonb_array_elements($hisaab_bank$" + JSON.stringify(rows) + "$hisaab_bank$::jsonb) item on conflict(id) do update set payload=excluded.payload;\n";
if (process.argv.includes('--check')) {
 if (fs.readFileSync(output,'utf8') !== sql) throw new Error('Server question seed is stale. Run node editions/hisaab/server/seed-bank.mjs.');
} else fs.writeFileSync(output,sql);
console.log(`HISAAB server seed: ${rows.length} questions${process.argv.includes('--check') ? ' verified' : ' written'}.`);

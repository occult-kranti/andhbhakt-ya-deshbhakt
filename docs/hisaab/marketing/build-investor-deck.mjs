import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';

// Run a copy from a private build directory with the supplied runtime node_modules.
const workspaceDir = process.env.HISAAB_DECK_WORKSPACE;
const sourceRoot = process.env.HISAAB_MARKETING_SOURCE;
const SKILL_DIR = '/root/.codex/skills/builtins/presentations';
const RUNTIME_PYTHON = process.env.CODEX_PRIMARY_RUNTIME_PYTHON;
if (![workspaceDir, sourceRoot, RUNTIME_PYTHON].every(x => x && path.isAbsolute(x))) throw new Error('Absolute task paths required');
const { finalizePresentation, resolvePresentationFont } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
const outName = process.env.HISAAB_DECK_FILENAME || 'HISAAB-DO-investor-deck.pptx';
const FINAL_PPTX = path.join(workspaceDir, 'output', outName);
const previewDir = path.join(workspaceDir, '.build', 'previews');
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const F = { serif: resolvePresentationFont({ fontFamily: 'Nimbus Roman' }), sans: resolvePresentationFont({ fontFamily: 'Nimbus Sans' }) };
const C = { paper:'#f2eddf', ink:'#252219', muted:'#565044', violet:'#5b2b92', night:'#14131b', cream:'#f5efe2', lavender:'#c8a7ed', rule:'#b9b09b' };
const p = Presentation.create({ slideSize: { width:1280, height:720 } });
let current;
function text(value,x,y,w,h,size=28,opts={}) {
  const q = current.shapes.add({ geometry:'textbox',name:opts.name || value.slice(0,55),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0} });
  q.text = value;
  q.text.style = { typeface:opts.serif?F.serif:F.sans,fontSize:size,color:opts.color||C.ink,bold:!!opts.bold,autoFit:'none',alignment:opts.align||'left',verticalAlignment:'top',...opts.style };
  return q;
}
function line(y,color=C.rule,x=64,w=1152) { current.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:0},fill:'none',line:{fill:color,width:1}}); }
function slide(title,n,{dark=false}={}) {
  current=p.slides.add(); current.background.fill=dark?C.night:C.paper;
  text('HISAAB DO',64,28,450,36,24,{serif:true,bold:true,color:dark?C.cream:C.ink});
  text(String(n).padStart(2,'0'),1140,28,70,36,22,{align:'right',color:dark?C.lavender:C.violet});
  line(77,dark?'#49414e':C.rule);
  if(title) text(title,64,103,1152,103,48,{serif:true,bold:true,color:dark?C.cream:C.ink});
  return current;
}
function notes(v){current.speakerNotes.textFrame.setText(v);}
async function img(file,x,y,w,h,alt){current.images.add({blob:new Uint8Array(await fs.readFile(path.join(sourceRoot,'assets',file))),contentType:'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}});}
function table(values,x,y,w,h,widths) {
  const t=current.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});
  t.styleOptions={headerRow:false,bandedRows:false};
  t.borders.assign({fill:C.rule,width:1,style:'solid'});
  t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({fill:C.paper,textStyle:{typeface:F.sans,fontSize:25,color:C.ink},margins:{left:14,right:14,top:12,bottom:12}});
  for(let col=0;col<values[0].length;col++){t.getCell(0,col).fill=C.violet;t.getCell(0,col).text.style={typeface:F.sans,fontSize:24,bold:true,color:'#ffffff'};}
  return t;
}

// 1: minimal masthead cover, all type remains editable.
current=p.slides.add(); current.background.fill=C.paper;
text('THE PUBLIC-MONEY QUIZ',64,61,1120,40,23,{color:C.violet,bold:true});
line(119,C.ink);
text('HISAAB DO',59,145,1159,165,126,{serif:true,bold:true});
text('Janta ka paisa.\nJanta ka sawaal.',65,338,990,171,55,{serif:true});
line(564,C.ink);
text('A bilingual browser game with a receipt after every answer.',65,588,1115,53,28);
text('Investor discussion   /   September 2026',65,661,1115,31,20,{color:C.muted});
notes('Source: HISAAB DO project charter and live product https://hisaab-do.whatswrong-inc.chatgpt.site. Early playable product. Traction, financing terms and revenue were not supplied. This deck makes no claim of independently validated demand.');

// 2: editorial thesis with clear distinction between a bet and evidence.
slide('The product bet',2);
text('Public money can become\na reason to play together.',64,224,760,166,60,{serif:true});
text('A short round gives a source-linked fact a social setting.\nThe hypothesis: players return for the group and stay curious about the receipt.',66,441,720,135,29);
text('FIRST PILOT COHORTS',886,229,315,45,22,{bold:true,color:C.violet});
text('Quiz groups\n\nCampus societies\n\nFriends and families',886,295,305,225,30);
text('Recruitment ideas, not measured demand.',886,567,310,72,23,{color:C.muted});
notes('Product hypothesis, not a measured market finding. Cohorts are proposed opt-in recruitment groups. No TAM or market share calculation has been supplied. Theory grounding: Ryan, Rigby & Przybylski (2006), https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf. Research in other games does not prove HISAAB retention.');

// 3: authentic product evidence; screenshot is an image, surrounding proof editable.
slide('A playable foundation',3);
text('English + Hindi',64,227,760,62,45,{serif:true,bold:true});
text('Daily play and topical files\nState, sector and money-trail discovery\nBots, friend play and pass-and-play',65,326,735,170,30);
text('Every answer has an explanation and a source link.\nThe approved paper-and-ink identity carries across screens.',65,535,730,103,28,{color:C.muted});
await img('day-edition-product.png',908,191,240,497,'Real Day edition mobile homepage from the prior published HISAAB release');
notes('Source: docs/hisaab/CHARTER.md and prior published implementation fc0cf4b0044b9927311f394fa00a2cfbd62438e9. Screenshot is the prior published Day edition, not the new online beta. Current bank inventory was verified by the root agent as 940 quiz items on 27 September 2026, but is omitted here to avoid confusing inventory with fresh fact-checking.');

// 4: one readable ordered flow with explicit runtime limitations.
slide('A duel with a referee',4,{dark:true});
const xs=[64,454,844];
const stages=[['01','Join the same match','The server controls the round and answer window.'],['02','Lock one answer','Correctness comes first. Speed follows the published rules.'],['03','Read the receipt','Personal feedback arrives after lock. The verdict follows both answers or deadline.']];
for(let i=0;i<3;i++){text(stages[i][0],xs[i],230,320,68,54,{serif:true,color:C.lavender});text(stages[i][1],xs[i],321,340,85,34,{serif:true,bold:true,color:C.cream});text(stages[i][2],xs[i],430,327,149,27,{color:C.cream});}
text('Online beta under construction. Guest identity stays on the device. Network delay still matters.',65,632,1120,44,23,{color:C.lavender});
notes('Architecture: server-refereed Supabase Edge commands and durable Postgres transactions, per docs/hisaab/SERVER-LAUNCH.md. Official status remains beta under construction until the root confirms deployment. Server authority concerns accepted commands and results, not a guarantee of equal latency or cheating prevention. Existing practice question data is public. No cash entry or cash prizes. Device-bound custom guest sessions are not Supabase accounts or cross-device recovery.');

// 5: balanced visual and research-grounded hypotheses.
slide('Reasons to return',5);
text('A familiar circle',65,230,757,58,40,{serif:true,bold:true});
text('Choose a nickname for the people you play with.',65,299,754,72,29);
text('A fresh competition window',65,396,757,62,40,{serif:true,bold:true});
text('Daily and weekly resets can offer a new start.\nPermanent personal progress remains yours.',65,470,735,105,29);
text('Retention hypothesis. No streak punishment or paid advantage.',65,629,761,52,22,{color:C.muted});
await img('night-edition-product.png',916,190,207,494,'Real Night edition settings screen showing user control of sound, theme and leaving the game');
notes('Hypotheses informed by autonomy, competence and relatedness in Ryan, Rigby & Przybylski (2006), https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf. No empirical HISAAB retention effect has been established. Screenshot from the prior published Night edition. Temporary competitive honours remain a private product surprise; the title is intentionally omitted here and in public campaign copy.');

// 6: original campaign artwork, single use in the deck.
slide('Distribution starts with one invitation',6);
await img('hisaab-launch-poster.png',64,219,338,421,'Original generated HISAAB DO editorial launch illustration, a fictional shared quiz table');
text('One question earns attention.\nOne receipt gives it substance.',466,229,735,118,43,{serif:true});
text('A community host shares a round.\nFriends join a scheduled session.\nThe next invitation follows a good game.',468,386,710,166,29);
text('Start with opt-in pilots. Measure completed play and return before buying reach.',468,588,709,83,27,{color:C.muted});
notes('Proposed distribution plan, not proven acquisition performance. See docs/hisaab/marketing/launch-calendar.md and social-posts.md. Illustration is original generated concept artwork, not a documentary image or endorsement. No outreach or posts were sent.');

// 7: editable commercial options table.
slide('Commercial experiments',7);
table([
  ['Option to test','Player and editorial boundary'],
  ['Labelled sponsorship','Sponsor recognition outside the answer and source.'],
  ['Approved display ads','Off-play spaces only. Ads remain disabled until configured.'],
  ['Cosmetics or hosted events','Optional later offer. No advantage in a ranked answer.'],
],64,237,1152,321,[355,797]);
text('Proposals only. No revenue forecast, shipped payment flow or AdSense approval is claimed.',65,606,1148,65,27,{color:C.muted});
notes('Business hypotheses, not existing revenue. Ads currently disabled according to docs/hisaab/LAUNCH-AND-ADS.md. Commercial commitments, eligibility and consent require appropriate review before activation. Source selection and answer correctness must remain independent of sponsors. No cash-entry or cash-prize tournament model is proposed.');

// 8: native evidence table with precise denominators in notes.
slide('The first evidence to collect',8);
table([
  ['Question','Measure'],
  ['Does the first round work?','Completion and receipt-open rate'],
  ['Do players choose to return?','D1 and D7 cohort return with sample sizes'],
  ['Does an invitation become play?','Invite open to completed duel'],
  ['Can the service support growth?','Match failures, latency and cost per match'],
],64,231,1152,367,[529,623]);
text('No baseline supplied. Guest identities approximate devices, not people.',65,639,1120,40,24,{color:C.muted});
notes('Measurement proposal. Definitions in docs/hisaab/marketing/launch-calendar.md. Activation denominator is eligible new identities starting a game; numerator completes a first round and opens its receipt. D1/D7 require full observation windows and documented UTC cohort definitions. Do not count repeat anonymous guest IDs as independently verified humans. Minimise data and complete privacy setup before analytics activation. No current conversion, revenue, CAC or retention data has been supplied.');

// 9: simple editorial roadmap, no invented dates or development completion.
slide('Launch stages',9);
const rows=[['PLAYABLE','Browser game','Solo files, bilingual receipts and social play.'],['BUILDING','Online beta','Server duels, competition windows and title expiry.'],['GATED','Broader launch','Multi-device proof, monitoring, corrections and an opt-in pilot.']];
rows.forEach((r,i)=>{let y=226+i*141;text(r[0],64,y+9,198,42,22,{bold:true,color:C.violet});text(r[1],300,y,885,51,37,{serif:true,bold:true});text(r[2],301,y+62,890,63,27);if(i<2)line(y+123,C.rule);});
notes('Status follows available evidence at deck authoring on 27 September 2026. Existing browser game is public. Server beta is under construction until confirmed deployed by the root release report. Broader launch requires operational and content gates, not a calendar promise. Existing Screenshots are labelled in their notes. Refer to docs/hisaab/SERVER-LAUNCH.md for the current technical service matrix.');

// 10: honest fundraising close with concrete milestones, no fictional ask.
slide('Investment milestones',10,{dark:true});
text('A stable community pilot.\nA measured reason to return.\nA supportable cost to serve.',64,231,1132,224,53,{serif:true,color:C.cream});
text('Proposed use of funds: content stewardship, multiplayer reliability\nand focused distribution experiments.',65,506,1130,97,29,{color:C.cream});
text('Raise amount, runway, team details and terms: founder input required.',65,637,1130,39,23,{color:C.lavender});
notes('This is an introductory investor product discussion, not a completed financing memorandum. Funding amount, runway, terms, founder/team details, cap table, revenue, traction and market size were not supplied and must not be invented. Suggested milestones are proposals, not achieved facts. Demo: https://hisaab-do.whatswrong-inc.chatgpt.site. Service pricing reference, accessed 27 September 2026: https://supabase.com/pricing. A paid public launch plan and variable usage need a real operating budget.');

const stagingDir=path.join(workspaceDir,'.codex-finalizer');
await fs.mkdir(stagingDir,{recursive:true});
const candidatePath=path.join(stagingDir,'candidate.pptx');
await(await PresentationFile.exportPptx(p)).save(candidatePath);
const result=await finalizePresentation({workspaceDir,candidatePath,finalPath:FINAL_PPTX,pythonExecutable:RUNTIME_PYTHON,integrityValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','7','--require-native-table-slide','8'],explicitTotalSlideCount:10,requiredNativeTableOwnerSlides:[7,8],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:[F.serif,F.sans]},verifyArtifactToolImport:true,receiptPath:path.join(stagingDir,`${outName}.validation.json`)});
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(FINAL_PPTX));
for(let i=0;i<10;i++){const s=finalDeck.slides.items[i];const b=await finalDeck.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(previewDir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));}
const montage=await finalDeck.export({format:'webp',montage:true,scale:0.5});
await fs.writeFile(path.join(previewDir,'montage.webp'),new Uint8Array(await montage.arrayBuffer()));
console.log(JSON.stringify({finalPath:FINAL_PPTX,previewDir,result},null,2));

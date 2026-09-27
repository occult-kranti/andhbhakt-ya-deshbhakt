import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Users, Copy, Radio, ArrowLeft } from 'lucide-react';
import { getCircleStore } from '../../../circles/store.mjs';
import { encodeInvite } from '../../../circles/model.mjs';
import { createCircleSession } from '../../../circles/live.mjs';
import type { Circle, CircleSnapshot, LivePeer } from '../../../circles/types';
import { absoluteUrl, href, navigate, queryString, type ScreenProps } from '../../router';
import { useAppPlayer } from '../../shell/player';
import { Page, ScreenHeader, InlineNote } from '../../ui/page';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import './circles.css';

const store = () => getCircleStore();
function useCircles() {
  const [source] = useState(store);
  return { source, snapshot: useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot) as CircleSnapshot };
}
const messageOf = (e: unknown) => e instanceof Error ? e.message : 'This change could not be saved. Please try again.';

export default function CirclesScreen({ route }: ScreenProps) {
  const { source, snapshot } = useCircles();
  const circle = snapshot.circles.find(c => c.id === route.params.id);
  if (route.params.id && circle) return <CirclePage key={circle.id} circle={circle} source={source} via={route.query.via === 'tab' ? 'tab' : 'net'} storageError={snapshot.error} />;
  return <CircleHub key={route.query.invite || 'hub'} invite={route.query.invite || ''} snapshot={snapshot} source={source} missing={!!route.params.id} />;
}

function CircleHub({ invite, snapshot, source, missing }: { invite: string; snapshot: CircleSnapshot; source: ReturnType<typeof store>; missing: boolean }) {
  const { t } = useLang();
  const [mode, setMode] = useState<'create' | 'join'>(invite ? 'join' : 'create');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [kind, setKind] = useState('friends');
  const [code, setCode] = useState(invite);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      const c = mode === 'create' ? await source.create({ name, nickname, kind }) : await source.join(code, nickname);
      if (c) navigate(href.circles(c.id), { replace: !!invite });
    } catch (err) { setError(messageOf(err)); }
    finally { working.current = false; setBusy(false); }
  }
  return <Page width="wide" screen="circles" className="h-circles">
    <ScreenHeader kicker="THE CIRCLE EDITION" titleHi="अपनों की बैठक" title={t('Your people. Your circle.', 'अपनों की बैठक।')} lead={t('A friends table. A family corner. Same questions, your own nicknames.', 'दोस्तों की टोली या परिवार की बैठक। वही सवाल, अपने उपनाम।')} />
    <Button href={href.online('circles')}>{t('Open server circles · Online beta', 'सर्वर मंडलियाँ खोलें · ऑनलाइन बीटा')}</Button>
    {missing && <InlineNote tone="wait">{t('This circle is not saved on this browser. Join with its invite link.', 'यह मंडली इस ब्राउज़र में नहीं है। इसके निमंत्रण लिंक से जुड़ें।')}</InlineNote>}
    {snapshot.error && <p role="alert" className="h-circles__notice">{snapshot.error}</p>}
    <div className="h-circles__layout">
      <section className="h-circles__panel" aria-labelledby="h-circle-form-title">
        <p className="h-kicker">{t('A SEAT AT THE TABLE', 'बैठक में आपकी जगह')}</p>
        <div className="h-circles__tabs" aria-label={t('Circle action', 'मंडली का काम')}>
          <Button aria-pressed={mode === 'create'} onClick={() => { setMode('create'); setError(''); }}>{t('Create circle', 'मंडली बनाएँ')}</Button>
          <Button aria-pressed={mode === 'join'} onClick={() => { setMode('join'); setError(''); }}>{t('Join circle', 'मंडली से जुड़ें')}</Button>
        </div>
        <h2 id="h-circle-form-title">{mode === 'create' ? t('Give the group a name.', 'मंडली का नाम रखें।') : t('Got an invite?', 'निमंत्रण मिला?')}</h2>
        <form onSubmit={e => void submit(e)} className="h-circles__form">
          {mode === 'create' ? <>
            <label>{t('Circle name', 'मंडली का नाम')}<input name="circle-name" required maxLength={80} autoComplete="off" placeholder={t('Sunday Chai Club', 'रविवार की चाय')} value={name} onChange={e => setName(e.target.value)} /></label>
            <label>{t('Circle type', 'मंडली का प्रकार')}<select name="circle-kind" value={kind} onChange={e => setKind(e.target.value)}><option value="friends">{t('Friends', 'दोस्त')}</option><option value="family">{t('Family', 'परिवार')}</option></select></label>
          </> : <label>{t('Invite link or code', 'निमंत्रण लिंक या कोड')}<textarea name="circle-invite" required maxLength={2048} rows={3} spellCheck={false} autoCapitalize="off" value={code} onChange={e => setCode(e.target.value)} /></label>}
          <label>{t('Your nickname in this circle', 'इस मंडली में आपका उपनाम')}<input name="circle-nickname" required maxLength={48} autoComplete="off" placeholder={t('Receipt Rani', 'रसीद रानी')} value={nickname} onChange={e => setNickname(e.target.value)} /><span>{t('Only for this circle. Your profile name stays yours.', 'सिर्फ़ इस मंडली के लिए। प्रोफ़ाइल का नाम नहीं बदलेगा।')}</span></label>
          {error && <p role="alert" className="h-circles__notice">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy || !!snapshot.error} busy={busy}>{busy ? t('Saving…', 'सहेज रहे हैं…') : mode === 'create' ? t('Create my circle', 'मेरी मंडली बनाएँ') : t('Join this circle', 'इस मंडली से जुड़ें')}</Button>
        </form>
      </section>
      <section className="h-circles__saved" aria-labelledby="h-circle-saved-title">
        <h2 id="h-circle-saved-title">{t('Your circles', 'आपकी मंडलियाँ')} <span className="h-mono">{snapshot.circles.length}</span></h2>
        {snapshot.circles.length ? <ul>{snapshot.circles.map(c => <li key={c.id}><a className="h-circles__card" href={href.circles(c.id)}><span className="h-kicker">{c.kind === 'family' ? t('FAMILY CIRCLE', 'परिवार की मंडली') : t('FRIENDS CIRCLE', 'दोस्तों की मंडली')}</span><strong>{c.name}</strong><span>{t('You are', 'आपका नाम')} <b>{c.nickname}</b></span><span className="h-circles__open">{t('Open circle', 'मंडली खोलें')} →</span></a></li>)}</ul> : <div className="h-circles__empty"><Users size={40} aria-hidden="true" /><h3>{t('The first seat is yours.', 'पहली जगह आपकी है।')}</h3><p>{t('Create a circle, then send the invite to people you know. No account or phone number needed.', 'मंडली बनाएँ और अपनों को लिंक भेजें। खाते या फ़ोन नंबर की ज़रूरत नहीं।')}</p></div>}
        <p className="h-circles__small">{t('Saved in this browser. Keep your invite to rejoin elsewhere. Connect together to see who is here.', 'इस ब्राउज़र में सहेजा जाता है। दूसरे उपकरण पर जुड़ने के लिए निमंत्रण रखें। उपस्थिति देखने के लिए साथ कनेक्ट करें।')}</p>
      </section>
    </div>
  </Page>;
}

function CirclePage({ circle, source, via, storageError }: { circle: Circle; source: ReturnType<typeof store>; via: 'net' | 'tab'; storageError: string }) {
  const { t } = useLang();
  const player = useAppPlayer();
  const xp = player.progression?.xp ?? 0;
  const [nickname, setNickname] = useState(circle.nickname);
  const [name, setName] = useState(circle.name);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [connection, setConnection] = useState('off');
  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [slow, setSlow] = useState(false);
  const connectionEpoch = useRef(0);
  const session = useRef<Awaited<ReturnType<typeof createCircleSession>> | null>(null);
  const remembered = useRef('');
  const saving = useRef(false);
  const invite = encodeInvite(circle);
  const link = absoluteUrl(`${href.circles()}${queryString({ invite })}`);
  useEffect(() => { setNickname(circle.nickname); setName(circle.name); }, [circle.nickname, circle.name]);
  useEffect(() => () => { connectionEpoch.current++; void session.current?.close(); session.current = null; }, []);
  useEffect(() => { session.current?.update({ nickname: circle.nickname, xp }); }, [circle.nickname, xp]);
  useEffect(() => {
    setSlow(false);
    if (connection !== 'listening') return;
    const timer = setTimeout(() => setSlow(true), 25000);
    return () => clearTimeout(timer);
  }, [connection]);
  async function connect() {
    if (connection !== 'off' && connection !== 'failed') return;
    const epoch = ++connectionEpoch.current;
    setConnection('opening'); setError('');
    try {
      const next = await createCircleSession({ circle, xp, via, onState: (state: { status: string; peers: LivePeer[] }) => {
        if (connectionEpoch.current !== epoch) return;
        setConnection(state.status); setPeers(state.peers);
        const signature = JSON.stringify(state.peers.map(p => [p.id, p.nickname]));
        if (signature !== remembered.current && state.peers.length) {
          remembered.current = signature;
          void source.remember(circle.id, state.peers).catch((err: unknown) => setError(messageOf(err)));
        }
      } });
      if (connectionEpoch.current !== epoch) { await next.close(); return; }
      session.current = next;
    } catch (err) { if (connectionEpoch.current === epoch) { setConnection('failed'); setError(messageOf(err)); } }
  }
  function disconnect() { connectionEpoch.current++; void session.current?.close(); session.current = null; setConnection('off'); setPeers([]); }
  async function save(e: FormEvent) {
    e.preventDefault(); if (saving.current) return; saving.current = true; setBusy(true); setError(''); setNotice('');
    try { await source.update(circle.id, { name, nickname }); setNotice(t('Circle details saved on this device.', 'इस उपकरण पर मंडली का विवरण सहेजा गया।')); }
    catch (err) { setError(messageOf(err)); }
    finally { saving.current = false; setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNotice(t('Invite copied. Send it to your friends or family.', 'निमंत्रण कॉपी हुआ। दोस्तों या परिवार को भेजें।')); }
    catch { setNotice(t('Select and copy the invite from the box below.', 'नीचे दिए लिंक को चुनकर कॉपी करें।')); }
  }
  async function leave() {
    if (saving.current) return; saving.current = true; setBusy(true); setError('');
    try { await source.leave(circle.id); disconnect(); navigate(href.circles(), { replace: true }); }
    catch (err) { setError(messageOf(err)); }
    finally { saving.current = false; setBusy(false); }
  }
  const duelLink = `${href.friend()}${queryString({ host: 1, circle: circle.id, name: circle.nickname, via: via === 'tab' ? 'tab' : '' })}`;
  return <Page width="wide" screen="circle-detail" className="h-circles">
    <Button href={href.circles()} variant="ghost" icon={<ArrowLeft size={18} />}>{t('All circles', 'सभी मंडलियाँ')}</Button>
    <ScreenHeader kicker={circle.kind === 'family' ? 'THE FAMILY CIRCLE' : 'THE FRIENDS CIRCLE'} title={circle.name} titleLang={/[\u0900-\u097f]/.test(circle.name) ? 'hi' : undefined} lead={<>{t('Around here, you are', 'यहाँ आपका नाम है')} <strong>{circle.nickname}</strong>.</>} />
    {(error || storageError) && <p role="alert" className="h-circles__notice">{error || storageError}</p>}
    {notice && <p role="status" className="h-circles__notice">{notice}</p>}
    <div className="h-circles__layout">
      <section className="h-circles__panel" aria-labelledby="h-circle-live">
        <p className="h-kicker">{t('THE COMMON ROOM', 'साझा बैठक')}</p>
        <h2 id="h-circle-live">{t('Meet here. Play together.', 'यहीं मिलें। साथ खेलें।')}</h2>
        <p>{t('Connect at the same time to see each other. Your circle nickname and device XP are shared only with connected invite holders.', 'एक-दूसरे को देखने के लिए एक साथ जुड़ें। आपका उपनाम और उपकरण का XP सिर्फ़ जुड़े हुए निमंत्रण धारकों को दिखता है।')}</p>
        <p className="h-circles__status" role="status"><Radio size={18} aria-hidden="true" />{connection === 'off' ? t('Not connected', 'जुड़े नहीं हैं') : connection === 'opening' ? t('Opening connection…', 'कनेक्शन खोल रहे हैं…') : connection === 'failed' ? t('Connection unavailable', 'कनेक्शन उपलब्ध नहीं') : connection === 'connected' ? t(`${peers.length + 1} connected now`, `${peers.length + 1} अभी जुड़े हैं`) : t('Listening for your people…', 'अपनों के जुड़ने का इंतज़ार…')}</p>
        <div className="h-circles__actions">
          <Button onClick={() => connection === 'off' || connection === 'failed' ? void connect() : disconnect()} disabled={connection === 'opening'}>{connection === 'off' || connection === 'failed' ? t('Connect circle', 'मंडली से कनेक्ट करें') : t('Disconnect', 'डिस्कनेक्ट करें')}</Button>
          <Button href={duelLink} variant="primary">{t('Start a friend duel', 'दोस्त से मुक़ाबला शुरू करें')}</Button>
        </div>
        {slow && <InlineNote tone="wait">{t('No one is visible yet. Ask a friend to open this circle and tap Connect circle. Some networks block direct connections. You can still share a duel invite or use Pass & Play.', 'अभी कोई दिखाई नहीं दे रहा। दोस्त से यह मंडली खोलकर कनेक्ट करने को कहें। कुछ नेटवर्क सीधे कनेक्शन रोकते हैं। आप मुक़ाबले का निमंत्रण या पास एंड प्ले इस्तेमाल कर सकते हैं।')}</InlineNote>}
        <ul className="h-circles__people"><li><span><strong>{circle.nickname}</strong> · {t('you', 'आप')}</span><span className="h-mono">{xp.toLocaleString('en-IN')} XP</span></li>{peers.map(p => <li key={p.id}><strong>{p.nickname}</strong><span className="h-mono">{p.xp.toLocaleString('en-IN')} XP</span></li>)}</ul>
        <p className="h-circles__small">{t('Device XP · self-reported, unranked.', 'उपकरण का XP · स्वयं बताया गया, बिना रैंकिंग।')}</p>
        <details className="h-circles__history"><summary>{t('How circles work', 'मंडलियाँ कैसे काम करती हैं')}</summary><p>{t('Circles are saved in each browser, with no always-online group server. Direct connections reveal your internet address to peers. Public relays help browsers connect; strict networks may block them.', 'मंडलियाँ हर ब्राउज़र में सहेजी जाती हैं; कोई हमेशा चालू समूह सर्वर नहीं है। सीधे कनेक्शन में साथियों को आपका इंटरनेट पता मिलता है। सार्वजनिक रिले कनेक्शन बनाते हैं; कुछ नेटवर्क उन्हें रोक सकते हैं।')}</p><p>{t('Invite holders can join without verified accounts. There are no member removals or invite revocation. For a new guest list, create a new circle.', 'निमंत्रण धारक बिना सत्यापित खाते के जुड़ सकते हैं। सदस्य हटाने या लिंक रद्द करने की सुविधा नहीं है। नए सदस्यों के लिए नई मंडली बनाएँ।')}</p></details>
        <Button href={href.pass()} variant="paper">{t('One phone? Pass & Play', 'एक फ़ोन? पास एंड प्ले')}</Button>
        {!!circle.members.length && <details className="h-circles__history"><summary>{t('People met on this device', 'इस उपकरण पर मिले लोग')} ({circle.members.length})</summary><p>{t('A local history, not the full circle membership. People not connected above may be offline or on another screen.', 'स्थानीय इतिहास, पूरी सदस्य सूची नहीं। ऊपर न दिख रहे लोग ऑफ़लाइन या किसी दूसरे पृष्ठ पर हो सकते हैं।')}</p><ul>{circle.members.map(m => <li key={m.id}>{m.nickname}</li>)}</ul></details>}
      </section>
      <div className="h-circles__aside">
        <section className="h-circles__panel" aria-labelledby="h-circle-invite-title"><h2 id="h-circle-invite-title">{t('Pass the invitation.', 'निमंत्रण भेजें।')}</h2><p>{t('Anyone with this link can join. Share it privately with people you know.', 'इस लिंक वाला कोई भी जुड़ सकता है। इसे सिर्फ़ अपने परिचितों को भेजें।')}</p><Button onClick={() => void copy()} icon={<Copy size={18} />}>{t('Copy circle invite', 'मंडली का लिंक कॉपी करें')}</Button><label className="h-circles__invite">{t('Circle invite link', 'मंडली का निमंत्रण लिंक')}<textarea readOnly rows={3} value={link} onFocus={e => e.currentTarget.select()} /></label><p className="h-circles__small">{t('Keep this invite to rejoin on another device.', 'दूसरे उपकरण पर जुड़ने के लिए निमंत्रण रखें।')}</p></section>
        <section className="h-circles__panel" aria-labelledby="h-circle-details-title"><h2 id="h-circle-details-title">{t('Your circle details', 'आपकी मंडली का विवरण')}</h2><form className="h-circles__form" onSubmit={e => void save(e)}><label>{t('Your nickname in this circle', 'इस मंडली में आपका उपनाम')}<input name="circle-nickname" required maxLength={48} value={nickname} onChange={e => setNickname(e.target.value)} /></label><label>{t('Circle name on this device', 'इस उपकरण पर मंडली का नाम')}<input name="circle-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /><span>{t('Renaming updates this device and new invites. Existing members keep their own saved title.', 'नया नाम इस उपकरण और नए निमंत्रण में दिखेगा। पुराने सदस्यों का सहेजा नाम नहीं बदलेगा।')}</span></label><Button type="submit" disabled={busy}>{t('Save circle details', 'मंडली का विवरण सहेजें')}</Button></form></section>
        <section className="h-circles__leave">{confirmLeave ? <><p>{t('Remove this circle from this browser? Other people keep their circle. Your invite will still work.', 'इस ब्राउज़र से मंडली हटाएँ? दूसरे सदस्यों की मंडली रहेगी। निमंत्रण अभी भी काम करेगा।')}</p><div className="h-circles__actions"><Button onClick={() => setConfirmLeave(false)}>{t('Keep circle', 'मंडली रखें')}</Button><Button onClick={() => void leave()} disabled={busy}>{t('Yes, leave circle', 'हाँ, मंडली छोड़ें')}</Button></div></> : <Button variant="ghost" onClick={() => setConfirmLeave(true)}>{t('Leave circle', 'मंडली छोड़ें')}</Button>}</section>
      </div>
    </div>
  </Page>;
}

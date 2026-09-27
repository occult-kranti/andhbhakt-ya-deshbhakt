/** Online beta: server-owned state, player profile, no local score authority. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Radio, Users, Trophy, Wifi, ArrowLeft, RefreshCw, Check, X } from 'lucide-react';
import { online } from '../../../online/runtime';
import type { OnlineMatch, PlayerSession, Words } from '../../../online/types';
import { href, absoluteUrl, type ScreenProps } from '../../router';
import { useChrome, useScreenTitle } from '../../shell/chrome';
import { useLang } from '../../ui/lang';
import { Button } from '../../ui/button';
import { Page, ScreenHeader } from '../../ui/page';
import { BrandName } from '../../ui/brand';
import { MatchSettingsButton } from '../room/match-settings';
import { OnlineSettings } from './settings';
import { CompetitionBoard } from './standings';
import { OnlineCircles } from './circles';
import { CompletionAdBreak } from '../../ads/completion-ad-break';
import { OutcomeCelebration } from '../../fx/outcome-celebration';
import './online.css';

const message = (error: unknown) => error instanceof Error ? error.message : 'The server could not complete this action.';
const errorCode = (error: unknown) => (error as { code?: string })?.code;
const safeSource = (url?: string) => { try { return url && new URL(url).protocol === 'https:' ? url : null; } catch { return null; } };

export default function OnlineScreen({ route }: ScreenProps) {
  const { t, isHi } = useLang();
  const [session, setSession] = useState<PlayerSession | null>(online.session);
  const [match, setMatch] = useState<OnlineMatch | null>(null);
  const [code, setCode] = useState(route.query.code || '');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(['all', 'today', 'subsidies', 'pre-election', 'media'].includes(route.query.file) ? route.query.file : 'all');
  const [stakeText, setStakeText] = useState('0');
  const stake = Number(stakeText);
  const balance = session?.balance ?? 0;
  const validStake = stakeText.trim() !== '' && Number.isSafeInteger(stake) && stake >= 0 && stake <= Math.min(10000, balance);
  useEffect(() => { if (['all', 'today', 'subsidies', 'pre-election', 'media'].includes(route.query.file)) setFile(route.query.file); }, [route.query.file]);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState(false);
  const [now, setNow] = useState(online.now());
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<{ roomId: string; round: number; choice: number; requestId: string } | null>(null);
  const [copyNote, setCopyNote] = useState('');
  const epoch = useRef(0);
  const working = useRef(false);
  const answerLock = useRef<string | null>(null);
  const alive = useRef(true);
  const matchRef = useRef<OnlineMatch | null>(null);
  useScreenTitle(t('Online Muqabla', 'ऑनलाइन मुक़ाबला'));
  useChrome(match ? 'none' : 'full');
  useEffect(() => { alive.current = true; return () => { alive.current = false; epoch.current++; }; }, []);

  const apply = useCallback((data: { match?: OnlineMatch; serverNow?: number }) => {
    const incoming = data.match;
    if (!incoming) return;
    const next = { ...incoming, serverNow: data.serverNow ?? incoming.serverNow };
    const previous = matchRef.current;
    if (previous?.id === next.id && previous.serverNow > next.serverNow) return;
    matchRef.current = next; setMatch(next); setConnected(true); setError('');
    // Keep the room through its final receipt; leaving the terminal view clears it and reapplies the profile gate.
    online.rememberRoom(next.id);
    if (previous?.round !== next.round || previous?.id !== next.id) { answerLock.current = null; setPendingChoice(null); setPendingAnswer(null); }
    if (next.receipt) { answerLock.current = `${next.id}:${next.round}`; setPendingChoice(next.receipt.choice); setPendingAnswer(null); }
  }, []);
  const fail = useCallback((e: unknown) => { if (!alive.current || errorCode(e) === 'CANCELLED') return; setError(message(e)); if (!errorCode(e) || ['NETWORK', 'TIMEOUT', 'SESSION_EXPIRED', 'UNAUTHORIZED', 'INVALID_SESSION'].includes(errorCode(e) || '')) setConnected(false); if (['SESSION_EXPIRED', 'UNAUTHORIZED', 'INVALID_SESSION'].includes(errorCode(e) || '')) setExpired(true); }, []);

  async function connect() {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); const turn = epoch.current;
    try {
      const player = await online.connect();
      if (!alive.current || epoch.current !== turn) return;
      setSession(player); setConnected(true);
      const saved = online.rememberedRoom();
      if (saved) {
        try { const data = await online.request('snapshot', { roomId: saved }); if (alive.current && epoch.current === turn) apply(data); }
        catch (e) { if (errorCode(e) === 'ROOM_NOT_FOUND' || errorCode(e) === 'MATCH_NOT_FOUND') online.rememberRoom(null); else throw e; }
      }
    } catch (e) { fail(e); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  // Only visit the server on an online route; the rest of HISAAB works without this service.
  useEffect(() => { if (online.session && online.configured) void connect(); /* resume once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); const turn = epoch.current;
    try { const data = await online.request(action, payload); if (alive.current && turn === epoch.current) apply(data); }
    catch (e) { fail(e); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => {
    if (!match || ['finished', 'cancelled'].includes(match.phase)) return;
    const id = match.id; const turn = epoch.current; const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>; let stopped = false; let failures = 0;
    const poll = async () => {
      try {
        const data = await online.request('snapshot', { roomId: id }, { signal: controller.signal });
        if (stopped || turn !== epoch.current) return;
        failures = 0; apply(data);
      } catch (e) { if (!stopped) { failures++; fail(e); } }
      if (!stopped) {
        const next = matchRef.current;
        const delay = next?.phase === 'countdown' ? Math.max(25, Math.min(750, next.startsAt - online.now())) : next?.phase === 'waiting' ? 1800 : 750;
        timer = setTimeout(poll, document.hidden ? 5000 : Math.min(8000, delay * Math.max(1, failures)));
      }
    };
    timer = setTimeout(poll, match.phase === 'countdown' ? Math.max(25, Math.min(750, match.startsAt - online.now())) : match.phase === 'waiting' ? 1200 : 750);
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [match?.id, match?.phase, apply, fail]);
  useEffect(() => {
    if (!match) return;
    const timer = setInterval(() => setNow(online.now()), 100);
    return () => clearInterval(timer);
  }, [match?.id]);
  useEffect(() => {
    if (!match || ['finished', 'cancelled'].includes(match.phase)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [match?.phase]);

  async function answer(choice: number) {
    const current = matchRef.current;
    if (working.current || !current || current.phase !== 'question' || current.receipt || answerLock.current === `${current.id}:${current.round}`) return;
    answerLock.current = `${current.id}:${current.round}`; setPendingChoice(choice);
    const payload = { roomId: current.id, round: current.round, choice, requestId: crypto.randomUUID() };
    setPendingAnswer(payload); await act('answer', payload);
  }
  async function leave() {
    const id = matchRef.current?.id; epoch.current++;
    matchRef.current = null; setMatch(null); setSettings(false); setError(''); setPendingChoice(null); setPendingAnswer(null); answerLock.current = null; online.rememberRoom(null);
    // Navigation is immediate; the server also expires absent players. A late response cannot restore the room.
    if (id) { try { await online.request('leave', { roomId: id }); } catch { /* user already left locally */ } }
    // The server's accepted-answer ledger owns this total; casual device XP is separate.
    try { const player = await online.connect(); if (alive.current) setSession(player); } catch (e) { fail(e); }
  }
  const resetIdentity = () => { online.forget(); setSession(null); setExpired(false); setError(''); setConnected(false); setMatch(null); matchRef.current = null; };
  const words = (value: Words | null | undefined) => value ? (isHi ? value.hi || value.en : value.en) : '';
  const remaining = match ? Math.max(0, (match.deadlineAt - now) / 1000) : 0;
  const elapsed = match ? Math.max(0, Math.min(30, (now - match.startsAt) / 1000)) : 0;
  const self = match?.players.find(p => p.id === match.selfId);
  const rival = match?.players.find(p => p.id !== match.selfId);
  const locked = !!match?.receipt || pendingChoice !== null || !!self?.answered;
  const terminal = match && ['finished', 'cancelled'].includes(match.phase);
  const receipt = match?.receipt || (match?.result && match.question ? { choice: null, correct: false, correctIndex: match.result.correctIndex, elapsedMs: 30000, xp: 0, explanation: match.result.explanation, sourceUrl: match.result.sourceUrl } : null);
  const source = safeSource(receipt?.sourceUrl);
  const view = route.view || 'play';

  if (match) return <Page screen="online-match" width="play" className="h-online h-online--match">
    <header className="h-online__matchhead"><BrandName /><MatchSettingsButton onClick={() => setSettings(true)} /></header>
    <div className="h-online__dateline"><span>{t('ONLINE BETA', 'ऑनलाइन बीटा')} · {match.mode === 'private' ? t('Private table', 'निजी बैठक') : match.mode === 'tournament' ? t('Tournament', 'टूर्नामेंट') : t('Ranked table', 'रैंक वाला मुक़ाबला')}</span><span className="h-online__connection"><Wifi size={14} aria-hidden="true" />{connected ? t('Connected', 'कनेक्टेड') : t('Reconnecting', 'फिर जुड़ रहे हैं')}</span></div>
    <div className="h-online__scoreboard">{match.players.map(p => <div key={p.id}><span>{p.id === match.selfId ? t('YOU · CORRECT', 'आप · सही') : t('OPPONENT · CORRECT', 'प्रतिद्वंद्वी · सही')}</span><strong>{p.nickname}</strong><b>{p.score}</b></div>)}</div>
    {error && <div className="h-online__notice" role="alert"><p>{error}</p><Button size="s" disabled={busy} onClick={() => void act('snapshot', { roomId: match.id })} icon={<RefreshCw size={16} />}>{t('Reconnect', 'फिर जुड़ें')}</Button>{pendingAnswer && <Button size="s" disabled={busy} onClick={() => void act('answer', pendingAnswer)}>{t('Check my locked answer', 'लॉक जवाब फिर भेजें')}</Button>}</div>}
    {match.phase === 'waiting' ? <section className="h-online__waiting">
      <p className="h-kicker">{rival ? t('YOUR TABLE IS READY', 'बैठक तैयार है') : t('A SEAT IS OPEN', 'एक जगह ख़ाली है')}</p>
      <h1>{rival ? t(`${rival.nickname} is here.`, `${rival.nickname} आ गए।`) : match.mode === 'private' ? t('Send a friend the code.', 'दोस्त को कोड भेजें।') : t('Looking for a player…', 'खिलाड़ी खोज रहे हैं…')}</h1>
      {match.mode === 'private' && <><p className="h-online__code">{match.code}</p><Button icon={<Copy size={18} />} onClick={() => { void navigator.clipboard?.writeText(absoluteUrl(href.online('play', { code: match.code }))).then(() => setCopyNote(t('Invite copied.', 'निमंत्रण कॉपी हुआ।'))).catch(() => setCopyNote(t('Copy the code above to invite a friend.', 'ऊपर का कोड कॉपी कर दोस्त को भेजें।'))); }}>{t('Copy invite', 'निमंत्रण कॉपी करें')}</Button><p role="status">{copyNote}</p></>}
      <p>{t('Five questions. Thirty seconds per question. Both players press Ready before the countdown.', 'पाँच सवाल। हर सवाल के लिए तीस सेकंड। उलटी गिनती से पहले दोनों खिलाड़ी तैयार दबाएँ।')}</p>
      <p className="h-online__terms">{t('File', 'फ़ाइल')}: {fileName(match.file, isHi)} · {match.stake > 0 ? t(`${match.stake} simulated coins each · winner takes the ${match.stake * 2} coin pot. Draws and pre-start or system cancellation refund; leaving after both are ready forfeits your stake.`, `हर खिलाड़ी के ${match.stake} खेल के सिक्के · विजेता को ${match.stake * 2}। बराबरी, शुरू से पहले या सिस्टम रद्द पर वापसी; दोनों तैयार होने के बाद छोड़ने पर आपके सिक्के जाएँगे।`) : t('No wager. Nothing to lose from your balance.', 'बिना सिक्के लगाए। शेष राशि से कुछ नहीं जाएगा।')}</p>
      {match.stake > 0 && <p>{t('Pressing Ready reserves your stake. After play starts, leaving forfeits it. A 90-second absence while your opponent stays also forfeits; if both are absent, stakes return.', 'तैयार दबाने पर सिक्के सुरक्षित होंगे। खेल शुरू होने के बाद छोड़ने या दूसरे खिलाड़ी के रहते 90 सेकंड गायब रहने पर सिक्के जाएँगे। दोनों गायब हों तो वापसी।')}</p>}
      {rival && <Button variant="primary" disabled={busy || self?.ready} onClick={() => void act('ready', { roomId: match.id, stake: match.stake ?? 0 })}>{self?.ready ? t('Ready · waiting for opponent', 'तैयार · सामने वाले का इंतज़ार') : (match.stake > 0 ? t(`Confirm ${match.stake} coins & ready`, `${match.stake} सिक्के मंज़ूर · तैयार`) : t('Ready · no wager', 'तैयार · बिना सिक्के लगाए'))}</Button>}
      <Button variant="ghost" onClick={() => void leave()}>{t('Cancel and leave', 'रद्द कर बाहर जाएँ')}</Button>
    </section> : match.phase === 'countdown' ? <section className="h-online__waiting"><p className="h-kicker">{t(`ROUND ${match.round} OF ${match.roundCount}`, `राउंड ${match.round} / ${match.roundCount}`)}</p><h1>{t('Eyes on the question.', 'सवाल पर नज़र रखें।')}</h1><p className="h-online__countdown" aria-label={t('Seconds to start', 'शुरू होने में सेकंड')}>{Math.max(1, Math.ceil((match.startsAt - now) / 1000))}</p><p>{t('Both players receive the same server start time.', 'दोनों खिलाड़ियों के लिए सर्वर का शुरू करने का समय एक है।')}</p></section> : null}
    {match.phase === 'question' && !receipt && <section className="h-online__question">
      <div className="h-online__questionbar"><span className="h-kicker">{t(`ROUND ${match.round} / ${match.roundCount}`, `राउंड ${match.round} / ${match.roundCount}`)}</span><span className="h-online__watch" role="timer" aria-label={t('Elapsed time', 'बीता समय')}>{elapsed.toFixed(1)} s</span></div>
      <p className="h-online__subline">{locked ? t('Answer locked. Checking your receipt…', 'जवाब लॉक। रसीद आ रही है…') : t(`Correct answer: ${elapsed < 8 ? 30 : elapsed < 15 ? 20 : 10} XP · ${Math.ceil(remaining)} s left`, `सही जवाब: ${elapsed < 8 ? 30 : elapsed < 15 ? 20 : 10} XP · ${Math.ceil(remaining)} सेकंड बाकी`)}</p>
      <h1>{words(match.question?.prompt)}</h1>
      <div className="h-online__answers">{match.question?.options.map((option, index) => <button key={index} type="button" disabled={locked || remaining <= 0 || busy} aria-pressed={pendingChoice === index} onClick={() => void answer(index)}><b>{String.fromCharCode(65 + index)}</b><span>{words(option)}</span>{pendingChoice === index && <Check aria-hidden="true" size={20} />}</button>)}</div>
      {!locked && remaining <= 0 && <p role="status">{t('Time is up. Checking the server result…', 'समय ख़त्म। सर्वर का नतीजा आ रहा है…')}</p>}
    </section>}
    {receipt && <section className="h-online__receipt" data-correct={receipt.correct} aria-live="polite">
      <p className="h-kicker">{match.receipt ? t('YOUR ANSWER RECEIPT', 'आपके जवाब की रसीद') : t('ROUND RECEIPT · NO ANSWER', 'राउंड की रसीद · जवाब नहीं')}</p><h1>{receipt.correct ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{receipt.correct ? t('Waah Waah! On record.', 'वाह वाह! दर्ज हो गया।') : match.receipt ? t('Not this time.', 'इस बार ग़लत।') : t('Time closed. Here’s the answer.', 'समय पूरा। यह रहा जवाब।')}</h1>
      <p className="h-online__receiptmeta">{(receipt.elapsedMs / 1000).toFixed(2)} s <span>·</span> +{receipt.xp} XP</p>
      {match.question && <p><strong>{t('Correct answer:', 'सही जवाब:')}</strong> {words(match.question.options[receipt.correctIndex])}</p>}
      <p>{words(receipt.explanation)}</p>{source && <a className="h-link" href={source} target="_blank" rel="noopener noreferrer">{t('Read the source', 'स्रोत पढ़ें')} ↗</a>}
      {match.phase === 'question' && <p className="h-online__subline">{t('Your turn is complete. The shared score follows when the other answer arrives or time ends.', 'आपकी बारी पूरी। दूसरे जवाब या समय सीमा के बाद साझा स्कोर आएगा।')}</p>}
    </section>}
    {match.phase === 'result' && <section className="h-online__roundresult"><h2>{match.result?.winnerId ? match.result.winnerId === match.selfId ? t('You take this round.', 'यह राउंड आपका।') : t(`${rival?.nickname || 'Opponent'} takes this round.`, 'सामने वाला यह राउंड जीता।') : t('A shared round.', 'बराबरी का राउंड।')}</h2><ul>{match.result?.answers.map(a => <li key={a.playerId}><strong>{match.players.find(p => p.id === a.playerId)?.nickname}</strong><span>{a.correct ? t('Correct', 'सही') : t('Incorrect / no answer', 'ग़लत / कोई जवाब नहीं')} · {(a.elapsedMs / 1000).toFixed(2)} s</span></li>)}</ul><Button variant="primary" disabled={busy || self?.ready} onClick={() => void act('next', { roomId: match.id })}>{self?.ready ? t('Ready for next round', 'अगले राउंड के लिए तैयार') : t('Next round', 'अगला राउंड')}</Button><p className="h-online__subline">{t('Both ready moves on now; otherwise the next round follows after the reading break.', 'दोनों तैयार तो अगला राउंड अभी; वरना रसीद पढ़ने का समय ख़त्म होने पर।')}</p></section>}
    {terminal && <section className="h-online__waiting"><p className="h-kicker">{t('MATCH FILED', 'मुक़ाबला दर्ज')}</p><h1>{match.phase === 'cancelled' ? t('The table has closed.', 'बैठक बंद हो गई।') : match.winnerId === match.selfId ? t('Hisaab settled. You win.', 'हिसाब पूरा। आप जीते।') : match.winnerId ? t('The duel is theirs. The facts are yours.', 'मुक़ाबला उनका। सीख आपकी।') : t('Even on the record.', 'रिकॉर्ड में बराबरी।')}</h1>{match.reason && <p>{match.reason.endsWith('-forfeit') ? (match.winnerId === match.selfId ? t('Your opponent left or stayed disconnected after play began. Their reserved stake was awarded to you. This is not a completed ranked match; no file reward is earned.', 'सामने वाले ने खेल शुरू होने के बाद छोड़ा। उनके सुरक्षित सिक्के आपको मिले। यह पूरा रैंक मुक़ाबला नहीं; फ़ाइल इनाम नहीं मिला।') : t('You left or stayed disconnected after play began. Your reserved stake went to your opponent. No file reward or ranked result was recorded.', 'खेल शुरू होने के बाद आप चले गए या कनेक्शन से बाहर रहे। आपके सुरक्षित सिक्के प्रतिद्वंद्वी को मिले। फ़ाइल इनाम या रैंक नतीजा दर्ज नहीं हुआ।')) : t('The match ended before completion. Any reserved stake was returned.', 'मुक़ाबला पूरा होने से पहले बंद हुआ। सुरक्षित सिक्के वापस किए गए।')}</p>}{match.phase === 'finished' && <OutcomeCelebration key={match.id} outcome={!match.winnerId ? 'draw' : match.winnerId === match.selfId ? 'win' : 'loss'} />}{match.economy && <div className="h-online__settlement"><h2>{t('Your UPI tax savings', 'आपकी UPI टैक्स बचत')}</h2><p>{t(`Balance: ${match.economy.balance} simulated coins`, `शेष: ${match.economy.balance} खेल के सिक्के`)}</p><p>{t(`Stake return / pot: +${match.economy.payout} · earned file reward: +${match.economy.reward}`, `सिक्कों की वापसी / पॉट: +${match.economy.payout} · फ़ाइल इनाम: +${match.economy.reward}`)}</p><p className="h-online__subline">{t('Game coins only. No real tax savings or cash value.', 'सिर्फ़ खेल के सिक्के। असली टैक्स बचत या नक़द मूल्य नहीं।')}</p></div>}<p>{t('Completed eligible public matches count on the server boards. Casual progress on this device stays separate.', 'योग्य सार्वजनिक मुक़ाबले सर्वर रैंकिंग में जुड़ते हैं। इस डिवाइस की प्रगति अलग रहती है।')}</p><Button variant="primary" onClick={() => void leave()}>{t('Back to online desk', 'ऑनलाइन डेस्क पर वापस')}</Button><Button onClick={() => { void leave(); location.hash = href.online('standings'); }}>{t('Read the standings', 'रैंकिंग पढ़ें')}</Button></section>}
    <p className="h-online__fairness">{t('Correctness first, then server-recorded answer time. Within 0.12 s: a draw. Your connection can affect timing.', 'पहले सही जवाब, फिर सर्वर पर दर्ज समय। 0.12 सेकंड के अंदर बराबरी। कनेक्शन समय को प्रभावित कर सकता है।')}</p>
    {match.phase === 'finished' && <CompletionAdBreak key={match.id} completionId={`online:${match.id}:${match.selfId}`} kind="duel" outcome={!match.winnerId ? 'draw' : match.winnerId === match.selfId ? 'win' : 'loss'} />}
    {settings && <OnlineSettings running={!terminal} stakeAtRisk={match.phase !== 'waiting' && !terminal ? match.stake : 0} onClose={() => setSettings(false)} onQuit={() => void leave()} />}
  </Page>;

  return <Page screen="online" className="h-online">
    <ScreenHeader kicker="THE LIVE EDITION · ONLINE BETA" titleHi="आमने सामने" title={view === 'standings' ? t('The standings', 'रैंकिंग') : view === 'circles' ? t('Your online circle', 'आपकी ऑनलाइन मंडली') : t('Same question. Real opponent.', 'एक सवाल। असली प्रतिद्वंद्वी।')} lead={t('Bring the facts. The server keeps the score.', 'तथ्य साथ लाओ। हिसाब सर्वर रखेगा।')} />
    <nav className="h-online__tabs" aria-label={t('Online sections', 'ऑनलाइन हिस्से')}><a aria-current={view === 'play' ? 'page' : undefined} href={href.online() }><Radio size={17} />{t('Play', 'खेलें')}</a><a aria-current={view === 'standings' ? 'page' : undefined} href={href.online('standings')}><Trophy size={17} />{t('Standings & cups', 'रैंकिंग व कप')}</a><a aria-current={view === 'circles' ? 'page' : undefined} href={href.online('circles')}><Users size={17} />{t('Circles', 'मंडलियाँ')}</a></nav>
    {!online.configured ? <div className="h-online__notice"><h2>{t('The online desk is not connected yet.', 'ऑनलाइन डेस्क अभी जुड़ा नहीं है।')}</h2><p>{t('Live matches and server standings will appear here once the service is connected. You can invite a friend directly or play together on one phone.', 'सर्विस जुड़ने पर लाइव मुक़ाबले और सर्वर रैंकिंग यहाँ दिखेंगे। दोस्त को सीधे बुलाएँ या एक फ़ोन पर साथ खेलें।')}</p><Button variant="primary" href={href.friend()}>{t('Invite a real friend', 'असली दोस्त को बुलाएँ')}</Button><Button href={href.pass()}>{t('Two people · one phone', 'दो खिलाड़ी · एक फ़ोन')}</Button><Button href={href.aaj()}>{t('Daily practice', 'आज का अभ्यास')}</Button></div> : <>
      {error && <div className="h-online__notice" role="alert"><p>{error}</p>{expired ? <Button onClick={resetIdentity}>{t('Restore or create a player file', 'फ़ाइल लौटाएँ या नई बनाएँ')}</Button> : <Button size="s" disabled={busy} onClick={() => void connect()}>{t('Retry connection', 'फिर कनेक्ट करें')}</Button>}</div>}
      {!session || !connected ? <section className="h-online__identity"><h2>{t('Reconnect to your desk.', 'अपने डेस्क से फिर जुड़ें।')}</h2><p className="h-online__subline">{t('Your player file must be checked by the server before a new table opens.', 'नई बैठक खोलने से पहले सर्वर आपकी खिलाड़ी फ़ाइल जाँचेगा।')}</p><Button variant="primary" disabled={busy} busy={busy} onClick={() => void connect()}>{t('Retry connection', 'फिर कनेक्ट करें')}</Button></section> : view === 'standings' ? <CompetitionBoard /> : view === 'circles' ? <OnlineCircles /> : <>
        <div className="h-online__byline"><span>{t('PLAYING AS', 'खेल रहे हैं')} <strong>{session.nickname}</strong></span><span>{t('ONLINE XP', 'ऑनलाइन XP')} <strong>{session.onlineXp ?? 0}</strong></span><span>{t('UPI TAX SAVINGS', 'UPI टैक्स बचत')} <strong>{session.balance ?? 0}</strong> {t('coins', 'सिक्के')}</span><span><Wifi size={15} aria-hidden="true" /> {t('Connected', 'कनेक्टेड')}{online.latencyMs !== null ? ` · ${online.latencyMs} ms` : ''}</span></div>
        <div className="h-online__desk">
          <section className="h-online__leadplay">
            <p className="h-kicker">{t('THE PUBLIC TABLE', 'सार्वजनिक बैठक')}</p>
            <h2>{t('Bring your facts.', 'तथ्य साथ लाओ।')}</h2>
            <p>{t('A real player. The same file and stake. Both confirm before play.', 'असली खिलाड़ी। एक फ़ाइल, बराबर सिक्के। खेल से पहले दोनों की मंज़ूरी।')}</p>
            <label htmlFor="h-online-file">{t('Choose a file', 'फ़ाइल चुनें')}</label>
            <select id="h-online-file" value={file} disabled={busy} onChange={e => setFile(e.target.value)}>
              {['all', 'today', 'subsidies', 'pre-election', 'media'].map(id => <option value={id} key={id}>{fileName(id, isHi)}{['subsidies', 'pre-election', 'media'].includes(id) ? ' · ×10 earned rewards' : ''}</option>)}
            </select>
            <div className="h-online__rewardnote"><strong>{['subsidies', 'pre-election', 'media'].includes(file) ? t('×10 file reward · 100 coins', '×10 फ़ाइल इनाम · 100 सिक्के') : t('File reward · 10 coins', 'फ़ाइल इनाम · 10 सिक्के')}</strong><p>{t('Once per file per UTC day: both players answer at least 3; you get at least 1 right. Complete the human duel. The bonus does not multiply your stake.', 'हर फ़ाइल पर UTC दिन में एक बार: दोनों कम-से-कम 3 जवाब दें, आपका 1 सही हो। इंसानी मुक़ाबला पूरा करें। बोनस लगाए सिक्कों पर नहीं बढ़ता।')}</p></div>
            <fieldset className="h-online__stake"><legend>{t('Optional stake · UPI tax savings', 'वैकल्पिक सिक्के · UPI टैक्स बचत')}</legend>
              <div className="h-online__stakechoices">{[0, 10, 25].map(value => <button type="button" key={value} disabled={busy || value > balance} aria-pressed={stake === value} onClick={() => setStakeText(String(value))}>{value === 0 ? t('No wager', 'बिना सिक्के') : `${value} ${t('coins', 'सिक्के')}`}</button>)}</div>
              <label htmlFor="h-online-stake">{t('Or enter your amount', 'या अपनी रकम लिखें')}</label>
              <input id="h-online-stake" type="number" inputMode="numeric" min="0" max={Math.min(balance, 10000)} step="1" value={stakeText} aria-invalid={!validStake} aria-describedby="h-online-stake-note" disabled={busy} onChange={e => setStakeText(e.target.value)} />
              <p id="h-online-stake-note" className="h-online__subline">{validStake ? t(`${balance} available. 0 always lets you play. Simulated coins: no UPI payment or withdrawal.`, `${balance} उपलब्ध। 0 पर हमेशा खेल सकते हैं। खेल के सिक्के: UPI भुगतान या निकासी नहीं।`) : t(`Enter a whole number from 0 to ${Math.min(balance, 10000)}. Choose No wager to play free.`, `0 से ${Math.min(balance, 10000)} तक पूरा अंक लिखें। मुफ़्त खेलने के लिए बिना सिक्के चुनें।`)}</p>
            </fieldset>
            <Button variant="primary" disabled={busy} busy={busy} onClick={() => { if (!validStake) { document.getElementById('h-online-stake')?.focus(); return; } void act('queue', { mode: route.query.tournament === '1' ? 'tournament' : 'ranked', file, stake }); }}>{route.query.tournament === '1' ? t('Find a tournament opponent', 'टूर्नामेंट प्रतिद्वंद्वी ढूँढ़ें') : t('Find a duel', 'मुक़ाबला ढूँढ़ो')}</Button>
            <p className="h-online__subline">{t('Human opponents only · 5 rounds · 30 s each', 'केवल इंसानी प्रतिद्वंद्वी · 5 राउंड · हर राउंड 30 सेकंड')}</p>
          </section>
          <section className="h-online__private">
            <p className="h-kicker">{t('THE FRIENDS TABLE', 'दोस्तों की बैठक')}</p><h2>{t('Settle it with a friend.', 'दोस्त के साथ हिसाब करो।')}</h2>
            <p>{t('Invite by code. Uses your chosen file and optional stake. Your friend reviews both before pressing Ready.', 'कोड से बुलाएँ। आपकी चुनी फ़ाइल और वैकल्पिक सिक्के। दोस्त तैयार होने से पहले दोनों देखेगा।')}</p>
            <Button disabled={busy} onClick={() => { if (!validStake) { document.getElementById('h-online-stake')?.focus(); return; } void act('create', { mode: 'private', file, stake }); }}>{t('Create private room', 'निजी रूम बनाएँ')}</Button>
            <form onSubmit={e => { e.preventDefault(); void act('join', { code: code.trim().toUpperCase() }); }}><label htmlFor="h-online-code">{t('Have a room code?', 'रूम कोड है?')}</label><div className="h-online__join"><input id="h-online-code" value={code} maxLength={16} minLength={8} required autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e => setCode(e.target.value)} /><Button type="submit" disabled={busy}>{t('Join', 'जुड़ें')}</Button></div></form>
            <div className="h-online__practice"><p className="h-kicker">{t('AT YOUR OWN PACE', 'अपनी गति से')}</p><h3>{t('Read it. Then duel it.', 'पढ़ो। फिर मुक़ाबला करो।')}</h3><p>{t('Practice files are solo learning, with a short ad between games when available.', 'अभ्यास फ़ाइलें अकेले सीखने के लिए हैं। उपलब्ध होने पर खेलों के बीच छोटा विज्ञापन।')}</p><Button href={href.aaj()}>{t('Practice today’s file', 'आज की फ़ाइल का अभ्यास')}</Button><Button variant="ghost" href={href.files()}>{t('Explore practice files', 'अभ्यास फ़ाइलें देखें')}</Button></div>
          </section>
        </div>
        <section className="h-online__rules"><h2>{t('A fairer table, clear rules.', 'साफ़ नियम, बेहतर मुक़ाबला।')}</h2><p>{t('Correct answer XP: under 8 s = 30 · under 15 s = 20 · 15 s or more = 10. Wrong answers earn no XP. The server records your first answer; it cannot be changed.', 'सही जवाब का XP: 8 सेकंड से कम = 30 · 15 सेकंड से कम = 20 · 15 सेकंड या अधिक = 10। ग़लत जवाब पर XP नहीं। सर्वर पहला जवाब दर्ज करता है; बदल नहीं सकते।')}</p><p>{t('Most correct answers wins the match. Equal accuracy: lower total answer time wins, with a 0.12 s draw window. Network delay still matters. Online beta profiles do not verify email or prevent every form of cheating.', 'सबसे ज़्यादा सही जवाब देने वाला मुक़ाबला जीतेगा। बराबर सही जवाब हों तो कुल कम समय जीतता है; 0.12 सेकंड के अंदर बराबरी। नेटवर्क की देरी असर डालती है। ऑनलाइन बीटा ईमेल सत्यापित नहीं करता और हर तरह की धोखाधड़ी रोकने का दावा नहीं करता।')}</p></section>
      </>}
    </>}
    {session && online.configured && <section className="h-online__delete"><h2>{t('Your player file', 'आपकी खिलाड़ी फ़ाइल')}</h2><p>{t('Manage your nickname, private unverified email, recovery code and online data in Profile. Your certificate photo stays on this device.', 'उपनाम, निजी असत्यापित ईमेल, रिकवरी कोड और ऑनलाइन डेटा प्रोफ़ाइल में सँभालें। प्रमाण पत्र की तस्वीर इसी डिवाइस पर रहती है।')}</p><Button size="s" href={href.me()}>{t('Open profile', 'प्रोफ़ाइल खोलें')}</Button></section>}
    <a className="h-link h-online__back" href={href.home()}><ArrowLeft size={17} />{t('Back to your desk', 'अपनी डेस्क पर वापस')}</a>
  </Page>;
}

function fileName(file: string | undefined, isHi: boolean) {
  const names: Record<string, [string, string]> = {
    all: ['All files', 'सभी फ़ाइलें'], today: ['Today’s file', 'आज की फ़ाइल'],
    subsidies: ['Subsidies & schemes', 'सब्सिडी और योजनाएँ'], 'pre-election': ['Pre-election spending', 'चुनाव से पहले का ख़र्च'], media: ['Who owns the media?', 'मीडिया का मालिक कौन?'],
  };
  return (names[file || 'all'] || names.all)[isHi ? 1 : 0];
}

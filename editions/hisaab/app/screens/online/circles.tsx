import { useEffect, useState, type FormEvent } from 'react';
import { online } from '../../../online/runtime';
import type { ServerCircle } from '../../../online/types';
import { href } from '../../router';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';

export function OnlineCircles() {
  const { t } = useLang();
  const [circles, setCircles] = useState<ServerCircle[]>([]); const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(''); const [kind, setKind] = useState('friends'); const [nickname, setNickname] = useState(online.session?.nickname || ''); const [code, setCode] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  async function request(operation: string, payload: Record<string, unknown> = {}) {
    if (busy) return; setBusy(true); setError('');
    try { const data = await online.request('circles', { operation, ...payload }); setCircles(data.circles || []); setLoaded(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update circle.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { let live = true; const controller = new AbortController(); setBusy(true);
    online.request('circles', { operation: 'list' }, { signal: controller.signal }).then((data: { circles: ServerCircle[] }) => { if (live) { setCircles(data.circles); setLoaded(true); } }).catch((e: Error) => { if (live) setError(e.message); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; controller.abort(); };
  }, []);
  const submit = (e: FormEvent) => { e.preventDefault(); void request(mode, mode === 'create' ? { name, nickname, kind } : { code: code.trim().toUpperCase(), nickname }); };
  return <section className="h-online__circles">
    <div className="h-online__desk"><section className="h-online__private"><p className="h-kicker">{t('A PLACE FOR YOUR PEOPLE', 'अपनों की जगह')}</p><h2>{t('Friends. Family. Your own names.', 'दोस्त। परिवार। अपने उपनाम।')}</h2><div className="h-online__tabs"><button type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>{t('Create', 'बनाएँ')}</button><button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>{t('Join', 'जुड़ें')}</button></div>
      <form onSubmit={submit}>{mode === 'create' ? <><label>{t('Circle name', 'मंडली का नाम')}<input required maxLength={40} value={name} onChange={e => setName(e.target.value)} /></label><label>{t('Circle type', 'मंडली का प्रकार')}<select value={kind} onChange={e => setKind(e.target.value)}><option value="friends">{t('Friends', 'दोस्त')}</option><option value="family">{t('Family', 'परिवार')}</option></select></label></> : <label>{t('Invite code', 'निमंत्रण कोड')}<input required maxLength={16} value={code} autoCapitalize="characters" onChange={e => setCode(e.target.value)} /></label>}<label>{t('Your nickname in this circle', 'इस मंडली में आपका उपनाम')}<input required minLength={2} maxLength={24} value={nickname} onChange={e => setNickname(e.target.value)} /></label><Button type="submit" variant="primary" disabled={busy}>{mode === 'create' ? t('Create circle', 'मंडली बनाएँ') : t('Join circle', 'मंडली से जुड़ें')}</Button></form>
    </section><section><h2>{t('Your circles', 'आपकी मंडलियाँ')}</h2>{error && <div className="h-online__notice" role="alert"><p>{error}</p><Button onClick={() => void request('list')} disabled={busy}>{t('Retry', 'फिर कोशिश करें')}</Button></div>}{!loaded && !error && <p role="status">{t('Loading circles…', 'मंडलियाँ आ रही हैं…')}</p>}{loaded && !circles.length && <p>{t('The first seat is yours. Create a circle and share its invite code with people you know.', 'पहली जगह आपकी। मंडली बनाएँ और अपनों से कोड साझा करें।')}</p>}{circles.map(circle => <CircleCard key={circle.id} circle={circle} busy={busy} request={request} />)}</section></div>
    <p className="h-online__subline">{t('Circle memberships are stored on the server under this browser’s guest identity. Anyone with the invite code can join. Only share it with your people.', 'मंडली की सदस्यता सर्वर पर इस ब्राउज़र की अतिथि पहचान में रहती है। कोड रखने वाला जुड़ सकता है। इसे सिर्फ़ अपनों से साझा करें।')}</p><Button variant="ghost" href={href.circles()}>{t('Open your older device circles', 'पुरानी डिवाइस मंडलियाँ खोलें')}</Button>
  </section>;
}
function CircleCard({ circle, busy, request }: { circle: ServerCircle; busy: boolean; request: (operation: string, payload?: Record<string, unknown>) => Promise<void> }) {
  const { t } = useLang(); const [nickname, setNickname] = useState(circle.nickname); const [leaving, setLeaving] = useState(false); const [copied, setCopied] = useState(false);
  return <article className="h-online__circle"><p className="h-kicker">{circle.kind === 'family' ? t('FAMILY CIRCLE', 'परिवार की मंडली') : t('FRIENDS CIRCLE', 'दोस्तों की मंडली')}</p><h3>{circle.name}</h3><p>{t('Invite code:', 'निमंत्रण कोड:')} <b className="h-mono">{circle.code}</b></p><Button size="s" onClick={() => { void navigator.clipboard?.writeText(circle.code).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? t('Copied', 'कॉपी हुआ') : t('Copy code', 'कोड कॉपी करें')}</Button><ul className="h-online__members">{circle.members.map(member => <li key={member.id}>{member.nickname}{member.id === online.session?.id ? t(' (you)', ' (आप)') : ''}</li>)}</ul><form onSubmit={e => { e.preventDefault(); void request('rename', { circleId: circle.id, nickname }); }}><label>{t('Your circle nickname', 'मंडली में आपका उपनाम')}<input required minLength={2} maxLength={24} value={nickname} onChange={e => setNickname(e.target.value)} /></label><Button size="s" type="submit" disabled={busy || nickname === circle.nickname}>{t('Save nickname', 'उपनाम सहेजें')}</Button></form><Button href={href.online()} size="s">{t('Open the friends table', 'दोस्तों की बैठक खोलें')}</Button>{leaving ? <div className="h-online__notice"><p>{t('Leave this circle? You can rejoin with its code.', 'मंडली छोड़ें? कोड से फिर जुड़ सकते हैं।')}</p><Button disabled={busy} onClick={() => void request('leave', { circleId: circle.id })}>{t('Yes, leave', 'हाँ, छोड़ें')}</Button><Button onClick={() => setLeaving(false)}>{t('Stay', 'रुकें')}</Button></div> : <Button size="s" variant="ghost" onClick={() => setLeaving(true)}>{t('Leave circle', 'मंडली छोड़ें')}</Button>}</article>;
}

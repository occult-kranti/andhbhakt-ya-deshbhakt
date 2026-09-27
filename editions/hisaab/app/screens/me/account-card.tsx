import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react';
import { EDITION } from '../../../edition';
import { online } from '../../../online/runtime';
import type { PlayerSession } from '../../../online/types';
import { href } from '../../router';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import './account-card.css';

const subscribe = (fn: () => void) => online.subscribe(fn);
const snapshot = () => online.session as PlayerSession | null;
const marks = [{ id: '', glyph: '—', en: 'None', hi: 'नहीं' }, { id: 'spark', glyph: '✦', en: 'Spark', hi: 'चमक' }, { id: 'shield', glyph: '◇', en: 'Shield', hi: 'ढाल' }, { id: 'book', glyph: '▣', en: 'Book', hi: 'किताब' }];
const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/;
export function AccountCard() {
  const session = useSyncExternalStore(subscribe, snapshot, () => null);
  const { t, locale } = useLang(); const id = useId();
  const [nickname, setNickname] = useState(session?.nickname || '');
  const [email, setEmail] = useState(session?.email || '');
  const [avatar, setAvatar] = useState(session?.avatar || '');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [secret, setSecret] = useState(''); const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setNickname(session?.nickname || ''); setEmail(session?.email || ''); setAvatar(session?.avatar || ''); }, [session?.id]);
  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true); setMessage('');
    try { const data = await online.request(action, payload); return data; }
    catch (e) { setMessage(e instanceof Error ? e.message : t('The server could not save that.', 'सर्वर इसे नहीं सहेज सका।')); return null; }
    finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (nickname.trim().length < 2 || nickname.trim().length > 24 || !EMAIL.test(email.trim()) || email.trim().length > 254) { setMessage(t('Enter a 2–24 character nickname and a valid email.', '2–24 अक्षर का उपनाम और सही ईमेल लिखें।')); return; }
    const data = await run('profile', { nickname: nickname.trim(), email: email.trim(), avatar: avatar || null, locale });
    if (data) setMessage(t('Profile saved on the server.', 'प्रोफ़ाइल सर्वर पर सहेजी गई।'));
  }
  async function exportData() {
    const data = await run('exportProfile'); if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'andhbhakt-ya-deshbhakt-online-profile.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setMessage(t('Online profile exported.', 'ऑनलाइन प्रोफ़ाइल एक्सपोर्ट हुई।'));
  }
  return <section className="h-account" aria-labelledby={`${id}-title`}>
    <div className="h-account__heading"><div><p className="h-kicker">{t('PLAYER PROFILE', 'खिलाड़ी प्रोफ़ाइल')}</p><h2 id={`${id}-title`}>{t('Your player file', 'आपकी खिलाड़ी फ़ाइल')}</h2></div><span>{session?.profileComplete ? t('Saved on this browser', 'इस ब्राउज़र में सहेजी') : t('Setup needed', 'फ़ाइल अधूरी')}</span></div>
    {!session ? <><p>{t('Create a profile before your first round. Your local level and certificate remain on this device.', 'पहले राउंड से पहले प्रोफ़ाइल बनाएँ। आपका स्थानीय लेवल और प्रमाण पत्र इसी डिवाइस पर रहते हैं।')}</p><Button href={href.online()} variant="primary">{t('Set up profile', 'प्रोफ़ाइल बनाएँ')}</Button></> : <>
      <p>{t('Nickname and qualifying results may appear publicly. Your email stays private, is unverified, and cannot sign you in or restore this profile. Your certificate photo stays only on this device.', 'उपनाम और योग्य नतीजे सार्वजनिक हो सकते हैं। ईमेल निजी और असत्यापित है; उससे साइन इन या फ़ाइल वापस नहीं मिलती। प्रमाण पत्र की तस्वीर इसी डिवाइस पर रहती है।')}</p>
      {!online.persistent && <p className="h-account__status" role="status">{t('Browser storage is unavailable. Keep your recovery code; this session may be lost when you close the tab.', 'ब्राउज़र में सहेजना उपलब्ध नहीं है। रिकवरी कोड सँभालें; टैब बंद करने पर यह सत्र खो सकता है।')}</p>}
      <form onSubmit={e => void save(e)}><label htmlFor={`${id}-nick`}>{t('Public nickname', 'सार्वजनिक उपनाम')}<input id={`${id}-nick`} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={24} minLength={2} autoComplete="nickname" /></label><label htmlFor={`${id}-email`}>{t('Email · private, unverified', 'ईमेल · निजी, असत्यापित')}<input id={`${id}-email`} type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} autoComplete="email" /></label><fieldset><legend>{t('Profile mark', 'प्रोफ़ाइल चिह्न')}</legend>{marks.map(mark => <label key={mark.id}><input name={`${id}-avatar`} type="radio" value={mark.id} checked={avatar === mark.id} onChange={() => setAvatar(mark.id)} /><span aria-hidden="true">{mark.glyph}</span><span className="h-sr">{t(mark.en, mark.hi)}</span></label>)}</fieldset><Button variant="paper" type="submit" disabled={busy}>{t('Save profile', 'प्रोफ़ाइल सहेजें')}</Button></form>
      <div className="h-account__tools"><Button variant="paper" disabled={busy} onClick={() => void exportData()}>{t('Export online data', 'ऑनलाइन डेटा निकालें')}</Button><Button variant="paper" disabled={busy} onClick={() => void run('rotateRecovery').then(data => { if (data?.recoveryCode) { setSecret(data.recoveryCode); setCopied(false); setMessage(t('New recovery code ready. The old one no longer works.', 'नया रिकवरी कोड तैयार। पुराना अब नहीं चलेगा।')); } })}>{t('Make a new recovery code', 'नया रिकवरी कोड बनाएँ')}</Button></div>
      {secret && <div className="h-account__secret"><strong>{t('Save this private code now', 'यह निजी कोड अभी सहेजें')}</strong><p>{t('Anyone with this code can restore your profile. It will not be shown again; email cannot recover it.', 'यह कोड रखने वाला आपकी फ़ाइल खोल सकता है। यह फिर नहीं दिखेगा; ईमेल से इसे वापस नहीं पा सकते।')}</p><code dir="ltr">{secret}</code><Button variant="paper" onClick={() => { void navigator.clipboard?.writeText(secret).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? t('Copied', 'कॉपी हुआ') : t('Copy code', 'कोड कॉपी करें')}</Button><Button variant="ghost" onClick={() => setSecret('')}>{t('I saved it', 'सहेज लिया')}</Button></div>}
      <div className="h-account__privacy"><a href={`${EDITION.base}privacy.html`}>{t('Privacy', 'निजता')}</a><a href={`${EDITION.base}terms.html`}>{t('Beta terms', 'बीटा नियम')}</a></div>
      <details className="h-account__delete"><summary>{t('Delete online player file', 'ऑनलाइन खिलाड़ी फ़ाइल मिटाएँ')}</summary><p>{t('This deactivates your profile, clears contact and recovery details, and removes you from standings and circles. Some pseudonymous match and coin ledger records remain for integrity. Device-only receipts and certificate photo remain.', 'इससे प्रोफ़ाइल बंद होगी, संपर्क और रिकवरी विवरण हटेंगे और रैंकिंग व मंडलियों से आपका नाम हटेगा। रिकॉर्ड की शुद्धता के लिए कुछ छद्मनाम वाले मैच और सिक्कों के लेखे रहेंगे। इस डिवाइस की रसीदें और तस्वीर रहेंगी।')}</p>{confirmDelete ? <div><Button disabled={busy} onClick={() => void run('deleteSession').then(data => { if (data) { online.forget(); setSecret(''); setConfirmDelete(false); } })}>{t('Delete permanently', 'हमेशा के लिए मिटाएँ')}</Button><Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('Keep profile', 'प्रोफ़ाइल रखें')}</Button></div> : <Button variant="ghost" onClick={() => setConfirmDelete(true)}>{t('Delete online profile…', 'ऑनलाइन प्रोफ़ाइल मिटाएँ…')}</Button>}</details>
    </>}
    {message && <p className="h-account__status" role="status">{message}</p>}
  </section>;
}

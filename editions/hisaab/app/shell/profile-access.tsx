/** Required, server-backed entry to the playable edition. Public pages remain readable. */
import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react';
import { online } from '../../online/runtime';
import { EDITION } from '../../edition';
import type { PlayerSession } from '../../online/types';
import { href } from '../router';
import { publicProfileRoute } from './profile-route.mjs';
import { Button } from '../ui/button';
import { useLang } from '../ui/lang';
import { Page } from '../ui/page';
import './profile-access.css';

const subscribe = (listener: () => void) => online.subscribe(listener);
const getSession = () => online.session as PlayerSession | null;
const getRoom = () => online.rememberedRoom();
const COMPLETE = (session: PlayerSession | null) => session?.profileComplete === true;
const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function ProfileAccess({ children, routeName, routeView }: { children: React.ReactNode; routeName: string; routeView: string | null }) {
  const session = useSyncExternalStore(subscribe, getSession, () => null);
  const rememberedRoom = useSyncExternalStore(subscribe, getRoom, () => null);
  const [verified, setVerified] = useState<string | null>(null);
  const [checking, setChecking] = useState(!!online.session);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [nickname, setNickname] = useState(session?.nickname || '');
  const [email, setEmail] = useState(session?.email || '');
  const [avatar, setAvatar] = useState(session?.avatar || '');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const { t, locale, setLocale } = useLang();
  const id = useId();
  useEffect(() => { setNickname(session?.nickname || ''); setEmail(session?.email || ''); setAvatar(session?.avatar || ''); }, [session?.id]);
  useEffect(() => {
    if (!session || !online.configured) { setChecking(false); return; }
    let live = true;
    setChecking(true);
    online.request('profile').then(data => {
      if (live) { setVerified(COMPLETE(data.session) ? data.session.id : null); setError(''); }
    }).catch(e => {
      if (live) { setVerified(null); setError(e instanceof Error ? e.message : t('Could not check your profile.', 'प्रोफ़ाइल जाँच नहीं सके।')); }
    }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
    // Verify once per identity on mount. A successful create/recovery response is itself server proof.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (publicProfileRoute(routeName, routeView)) return <>{children}</>;
  if (session && COMPLETE(session) && session.id === verified && !recoveryCode) return <>{children}</>;
  // A legacy live match must be allowed to finish or leave. New matchmaking still checks the server.
  if (routeName === 'online' && rememberedRoom && session) return <>{children}</>;
  if (!online.configured) return <Page screen="profile-access" className="h-access"><div className="h-access__folio"><span>{t('PLAYER FILE / 01', 'खिलाड़ी फ़ाइल / ०१')}</span></div><section className="h-access__sheet"><h1>{t('The player desk is unavailable.', 'खिलाड़ी डेस्क अभी उपलब्ध नहीं है।')}</h1><p>{t('This build is not connected to the profile server. Play needs a completed server profile. Please try again when the service is connected.', 'यह संस्करण प्रोफ़ाइल सर्वर से जुड़ा नहीं है। खेलने के लिए सर्वर पर पूरी प्रोफ़ाइल चाहिए। सर्विस जुड़ने पर फिर कोशिश करें।')}</p><div className="h-access__secondary"><a href={href.home()}>{t('Back to the desk', 'डेस्क पर वापस')}</a><a href={href.rules()}>{t('Rules & sources', 'नियम और स्रोत')}</a></div></section></Page>;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (recoveryMode) {
      if (!/^[a-f0-9]{64}$/i.test(codeInput.trim())) { setError(t('Enter your 64-character recovery code.', 'अपना 64 अक्षर का रिकवरी कोड लिखें।')); document.getElementById(`${id}-code`)?.focus(); return; }
    } else if (!nickname.trim() || nickname.trim().length < 2 || nickname.trim().length > 24 || !EMAIL.test(email.trim()) || email.trim().length > 254 || !adult || !terms) {
      setError(t('Check the nickname, email and both confirmations.', 'उपनाम, ईमेल और दोनों सहमतियाँ जाँचें।'));
      const field = nickname.trim().length < 2 || nickname.trim().length > 24 ? 'nick' : !EMAIL.test(email.trim()) || email.trim().length > 254 ? 'email' : !adult ? 'adult' : 'terms';
      document.getElementById(`${id}-${field}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (recoveryMode) {
        const restored = await online.recover(codeInput.trim().toLowerCase());
        setVerified(COMPLETE(restored.session) ? restored.session.id : null);
        if (!COMPLETE(restored.session)) { setRecoveryMode(false); setError(t('This profile needs to be completed before play.', 'खेलने से पहले प्रोफ़ाइल पूरी करें।')); }
        else setCodeInput('');
      } else {
        const payload = { nickname: nickname.trim(), email: email.trim(), adultConfirmed: true, termsVersion: 'beta-1', avatar: avatar || undefined, locale };
        const result = session ? await online.request('profile', payload) : await online.createProfile(payload);
        if (!COMPLETE(result.session)) throw new Error(t('The server has not completed this profile. Try again.', 'सर्वर ने प्रोफ़ाइल पूरी नहीं की। फिर कोशिश करें।'));
        setVerified(result.session.id);
        setRecoveryCode(result.recoveryCode || '');
      }
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not save your profile.', 'प्रोफ़ाइल नहीं बची।')); }
    finally { setBusy(false); }
  };
  return <Page screen="profile-access" className="h-access">
    <div className="h-access__folio"><span>{t('PLAYER FILE / 01', 'खिलाड़ी फ़ाइल / ०१')}</span><span>{t('ANDHBHAKT YA DESHBHAKT', 'अंधभक्त या देशभक्त')}</span></div>
    {recoveryCode ? <section className="h-access__sheet" aria-labelledby={`${id}-saved`}>
      <p className="h-access__eyebrow">{t('FILE OPENED', 'फ़ाइल खुल गई')}</p>
      <h1 id={`${id}-saved`}>{t('Keep your return key.', 'वापसी की चाबी सँभालें।')}</h1>
      <p>{t('This recovery code restores your profile on another device. It is shown only now. Keep it privately; anyone with it can take over this game profile. Your email cannot recover it.', 'यह रिकवरी कोड दूसरे डिवाइस पर आपकी प्रोफ़ाइल लौटाता है। यह सिर्फ़ अभी दिखेगा। इसे निजी रखें; जिसके पास यह होगा, वह इस गेम प्रोफ़ाइल को खोल सकेगा। ईमेल से इसे वापस नहीं पा सकते।')}</p>
      {!online.persistent && <p className="h-access__error" role="status">{t('Browser storage is unavailable. This profile will last only for this visit unless you save the recovery code now.', 'ब्राउज़र में सहेजना उपलब्ध नहीं है। रिकवरी कोड अभी सहेजें, वरना यह प्रोफ़ाइल सिर्फ़ इस बार रहेगी।')}</p>}
      <code className="h-access__code" dir="ltr">{recoveryCode}</code>
      <div className="h-access__actions"><Button variant="paper" onClick={() => { void navigator.clipboard?.writeText(recoveryCode).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? t('Copied', 'कॉपी हुआ') : t('Copy recovery code', 'रिकवरी कोड कॉपी करें')}</Button><Button variant="primary" onClick={() => setRecoveryCode('')}>{t('I saved it · continue', 'सहेज लिया · आगे')}</Button></div>
    </section> : <section className="h-access__sheet" aria-labelledby={`${id}-title`}>
      <p className="h-access__eyebrow">{t('BEFORE THE FIRST ROUND', 'पहले राउंड से पहले')}</p>
      <h1 id={`${id}-title`}>{recoveryMode ? t('Restore your player file.', 'अपनी फ़ाइल लौटाएँ।') : checking ? t('Checking your file…', 'फ़ाइल जाँच रहे हैं…') : t('Make your player file.', 'अपनी खिलाड़ी फ़ाइल बनाएँ।')}</h1>
      {checking ? <p role="status">{t('Checking your saved profile with the game server.', 'गेम सर्वर से आपकी प्रोफ़ाइल जाँच रहे हैं।')}</p> : <>
        <p className="h-access__lead">{recoveryMode ? t('Use the private recovery code you saved. Email alone cannot restore this profile.', 'अपने सहेजे हुए निजी रिकवरी कोड का इस्तेमाल करें। केवल ईमेल से फ़ाइल नहीं लौटती।') : t('One public nickname, one private email. No password or email link in this beta.', 'एक सार्वजनिक उपनाम, एक निजी ईमेल। इस बीटा में पासवर्ड या ईमेल लिंक नहीं है।')}</p>
        <form onSubmit={submit} noValidate>
          {recoveryMode ? <label htmlFor={`${id}-code`}>{t('Recovery code', 'रिकवरी कोड')}<input id={`${id}-code`} value={codeInput} onChange={e => setCodeInput(e.target.value)} maxLength={64} autoComplete="off" spellCheck={false} dir="ltr" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /></label> : <>
            <label htmlFor={`${id}-nick`}>{t('Public nickname', 'सार्वजनिक उपनाम')}<input id={`${id}-nick`} value={nickname} onChange={e => setNickname(e.target.value)} minLength={2} maxLength={24} autoComplete="nickname" required aria-invalid={!!error && (nickname.trim().length < 2 || nickname.trim().length > 24)} aria-describedby={error ? `${id}-error` : undefined} /></label>
            <label htmlFor={`${id}-email`}>{t('Email · private', 'ईमेल · निजी')}<input id={`${id}-email`} type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} autoComplete="email" required aria-invalid={!!error && (!EMAIL.test(email.trim()) || email.trim().length > 254)} aria-describedby={error ? `${id}-error` : undefined} /><small>{t('We do not verify this address or use it to sign you in. It is not shown to other players.', 'हम इस पते को सत्यापित नहीं करते या इससे साइन इन नहीं कराते। दूसरे खिलाड़ी इसे नहीं देखेंगे।')}</small></label>
            <fieldset className="h-access__avatars"><legend>{t('Your mark · optional', 'आपकी पहचान · वैकल्पिक')}</legend>{[{ value: '', glyph: '—', en: 'No mark', hi: 'कोई चिह्न नहीं' }, { value: 'spark', glyph: '✦', en: 'Spark', hi: 'चमक' }, { value: 'shield', glyph: '◇', en: 'Shield', hi: 'ढाल' }, { value: 'book', glyph: '▣', en: 'Book', hi: 'किताब' }].map(mark => <label key={mark.value}><input type="radio" name={`${id}-avatar`} value={mark.value} checked={avatar === mark.value} onChange={() => setAvatar(mark.value)} /><span aria-hidden="true">{mark.glyph}</span><span className="h-sr">{t(mark.en, mark.hi)}</span></label>)}</fieldset>
            <label htmlFor={`${id}-lang`}>{t('Reading language', 'पढ़ने की भाषा')}<select id={`${id}-lang`} value={locale} onChange={e => setLocale(e.target.value as 'en' | 'hi')}><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
            <label className="h-access__check"><input id={`${id}-adult`} type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} required aria-invalid={!!error && !adult} aria-describedby={error ? `${id}-error` : undefined} /><span>{t('I confirm I am 18 or older.', 'मैं पुष्टि करता/करती हूँ कि मेरी उम्र 18 या अधिक है।')}</span></label>
            <label className="h-access__check"><input id={`${id}-terms`} type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} required aria-invalid={!!error && !terms} aria-describedby={error ? `${id}-error` : undefined} /><span>{t('I agree to the beta terms and privacy notice.', 'मैं बीटा नियमों और निजता सूचना से सहमत हूँ।')}</span></label>
          </>}
          {error && <p id={`${id}-error`} className="h-access__error" role="alert">{error}</p>}
          <Button variant="primary" type="submit" busy={busy} disabled={busy}>{busy ? t('Checking…', 'जाँच रहे हैं…') : recoveryMode ? t('Restore profile', 'प्रोफ़ाइल लौटाएँ') : session ? t('Complete profile', 'प्रोफ़ाइल पूरी करें') : t('Save player file', 'खिलाड़ी फ़ाइल सहेजें')}</Button>
        </form>
        <div className="h-access__secondary"><button type="button" onClick={() => { setError(''); setRecoveryMode(!recoveryMode); }}>{recoveryMode ? t('Use profile form', 'प्रोफ़ाइल फ़ॉर्म खोलें') : t('Already have a recovery code?', 'पहले से रिकवरी कोड है?')}</button><a href={`${EDITION.base}privacy.html`}>{t('Privacy', 'निजता')}</a><a href={`${EDITION.base}terms.html`}>{t('Terms', 'नियम')}</a><a href={href.home()}>{t('Back to the desk', 'डेस्क पर वापस')}</a></div>
        {session && <div className="h-access__replace">{replaceConfirm ? <><p>{t('A new player file will replace the saved profile on this browser. Keep its recovery code if you want to return to it.', 'नई फ़ाइल इस ब्राउज़र की सहेजी हुई प्रोफ़ाइल की जगह लेगी। पुरानी फ़ाइल में लौटना हो तो उसका रिकवरी कोड सँभालें।')}</p><Button variant="paper" onClick={() => { online.forget(); setVerified(null); setReplaceConfirm(false); setRecoveryMode(false); setError(''); }}>{t('Start a separate profile', 'अलग प्रोफ़ाइल बनाएँ')}</Button><Button variant="ghost" onClick={() => setReplaceConfirm(false)}>{t('Keep this profile', 'यही प्रोफ़ाइल रखें')}</Button></> : <button type="button" onClick={() => setReplaceConfirm(true)}>{t('Use a different profile', 'दूसरी प्रोफ़ाइल इस्तेमाल करें')}</button>}</div>}
      </>}
    </section>}
  </Page>;
}

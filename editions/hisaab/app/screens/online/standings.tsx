import { useEffect, useState } from 'react';
import { online } from '../../../online/runtime';
import { activeCompetitionTitle } from '../../../engine/labels.mjs';
import type { Board, BoardRow, Tournament } from '../../../online/types';
import { href } from '../../router';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';

export function CompetitionBoard() {
  const { t, isHi } = useLang();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'tournament' | 'savings'>(() => new URLSearchParams(location.hash.split('?')[1]).get('period') === 'savings' ? 'savings' : 'daily');
  const [board, setBoard] = useState<Board | null>(null); const [events, setEvents] = useState<Tournament[]>([]);
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0); const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [now, setNow] = useState(online.now());
  useEffect(() => { const timer = setInterval(() => setNow(online.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setBoard(null); setUpdatedAt(0); }, [period]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setAttempt(n => n + 1); }, 30000);
    const refresh = () => { if (!document.hidden) setAttempt(n => n + 1); };
    document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let live = true; setLoading(true); setError('');
    online.request(period === 'tournament' ? 'tournaments' : 'leaderboards', period === 'tournament' ? {} : { period }, { signal: controller.signal }).then((data: Record<string, any>) => {
      if (!live) return;
      setBoard((period === 'tournament' ? data.standings : data) as Board); setEvents(data.tournaments || []); setUpdatedAt(online.now());
    }).catch((e: Error) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; controller.abort(); };
  }, [period, attempt]);
  const date = (value: number) => new Date(value).toLocaleString(isHi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const titleFor = (row: BoardRow) => !error && now - updatedAt < 35000 ? activeCompetitionTitle(row.title, now) : null;
  return <section className="h-online__standings">
    <div className="h-online__tabs" aria-label={t('Standings period', 'रैंकिंग की अवधि')}>{(['daily', 'weekly', 'tournament', 'savings'] as const).map(p => <button type="button" key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{p === 'daily' ? t('Today', 'आज') : p === 'weekly' ? t('This week', 'इस हफ़्ते') : p === 'savings' ? t('UPI tax savings', 'UPI टैक्स बचत') : t('Tournament', 'टूर्नामेंट')}</button>)}</div>
    {period === 'tournament' && events.map(event => <section key={event.id} className="h-online__tournament"><p className="h-kicker">{event.status === 'open' ? t('REGISTRATION OPEN', 'खेलने के लिए खुला') : event.status}</p><h2>{event.name}</h2><p>{t('Five-question matches. No entry fee or cash prize.', 'पाँच सवालों के मुक़ाबले। कोई प्रवेश शुल्क या नक़द इनाम नहीं।')}</p><p>{date(event.startsAt)} — {date(event.endsAt)}</p><Button variant="primary" href={href.online('play', { tournament: '1' })}>{t('Play in this tournament', 'इस टूर्नामेंट में खेलें')}</Button></section>)}
    {error && <div className="h-online__notice" role="alert"><p>{error}</p><Button onClick={() => setAttempt(n => n + 1)}>{t('Retry standings', 'रैंकिंग फिर लाएँ')}</Button></div>}
    {loading && <p role="status">{t('Getting the server standings…', 'सर्वर से रैंकिंग आ रही है…')}</p>}
    {board && <>
      <div className="h-online__boardhead"><h2>{period === 'savings' ? t('UPI tax savings', 'UPI टैक्स बचत') : period === 'daily' ? t('Today’s edition', 'आज का संस्करण') : period === 'weekly' ? t('The weekly edition', 'साप्ताहिक संस्करण') : t('Cup standings', 'कप की रैंकिंग')}</h2><p>{t('Window closes', 'अवधि पूरी')} <time dateTime={new Date(board.endsAt).toISOString()}>{date(board.endsAt)}</time></p></div>
      <p className="h-online__subline">{period === 'savings' ? t('Most simulated coins leads. Balance includes coins reserved in an active duel. No real UPI payments, tax savings or cash value.', 'सबसे अधिक खेल के सिक्के आगे। सक्रिय मुक़ाबले में सुरक्षित सिक्के भी गिने जाते हैं। असली UPI भुगतान, टैक्स बचत या नक़द मूल्य नहीं।') : t('Win = 3 points · draw = 1 · loss = 0. Order: points, correct answers, then total answer time. Tournament tables use your best five eligible matches.', 'जीत = 3 अंक · बराबरी = 1 · हार = 0। क्रम: अंक, सही जवाब, फिर कुल जवाब समय। टूर्नामेंट में आपके पाँच सर्वश्रेष्ठ योग्य मुक़ाबले गिने जाते हैं।')}</p>
      <p>{period === 'savings' ? t('Join this board after your first earned completion reward. Starter coins alone do not qualify.', 'पहला मुक़ाबला इनाम कमाने के बाद इस रैंकिंग में आएँ। सिर्फ़ शुरुआती सिक्के काफ़ी नहीं।') : t('To qualify: 3 completed public matches against 3 different opponents. Only one match per opponent per day contributes. Private rooms and abandoned matches do not count.', 'योग्यता: 3 अलग खिलाड़ियों के विरुद्ध 3 पूरे सार्वजनिक मुक़ाबले। हर प्रतिद्वंद्वी के साथ रोज़ एक मुक़ाबला गिना जाता है। निजी या अधूरे मुक़ाबले नहीं गिने जाते।')}</p>
      {board.rows?.length ? <div className="h-online__tablewrap"><table className="h-online__table"><caption className="h-sr">{t('Server standings', 'सर्वर रैंकिंग')}</caption><thead><tr><th scope="col">#</th><th scope="col">{t('Player', 'खिलाड़ी')}</th><th scope="col">{period === 'savings' ? t('Coins', 'सिक्के') : t('Points', 'अंक')}</th>{period !== 'savings' && <th scope="col">{t('Matches', 'मुक़ाबले')}</th>}</tr></thead><tbody>{board.rows.map(row => { const title = titleFor(row); return <tr key={row.id} data-self={row.id === online.session?.id}><td>{row.rank}</td><th scope="row"><span>{row.nickname}{row.id === online.session?.id ? t(' · you', ' · आप') : ''}</span>{title && <span className="h-online__honour"><b>{isHi ? title.labelHi : title.label}</b><small>{period === 'savings' ? t('Savings leader · until', 'बचत में प्रथम · तक') : t('Current top 10 · until', 'मौजूदा शीर्ष 10 · तक')} {date(title.expiresAt)}</small></span>}</th><td>{period === 'savings' ? row.savings : row.points}</td>{period !== 'savings' && <td>{row.matches}</td>}</tr>; })}</tbody></table></div> : <div className="h-online__empty"><h3>{t('The first edition is being written.', 'पहला संस्करण लिखा जा रहा है।')}</h3><p>{t('No qualifying players in this window yet. Play a public match to begin.', 'इस अवधि में अभी कोई योग्य खिलाड़ी नहीं। सार्वजनिक मुक़ाबले से शुरुआत करें।')}</p></div>}
      {board.self && !board.rows.some(r => r.id === board.self!.id) && <p>{t('Your place:', 'आपका स्थान:')} #{board.self.rank} · {period === 'savings' ? board.self.savings : board.self.points} {period === 'savings' ? t('coins', 'सिक्के') : t('points', 'अंक')}</p>}
      <p className="h-online__subline">{updatedAt ? t(`Last updated ${date(updatedAt)}. Refreshes every 30 seconds while this page is visible.`, `अंतिम अपडेट ${date(updatedAt)}। पेज खुला होने पर हर 30 सेकंड में अपडेट।`) : ''}</p>
      <p className="h-online__subline">{t('Server-recorded results and player profiles. Email is not verified. This beta board is not proof of unique people or a cheating-free contest.', 'नतीजे सर्वर पर दर्ज और खिलाड़ी प्रोफ़ाइल से जुड़े हैं। ईमेल सत्यापित नहीं है। बीटा रैंकिंग अलग-अलग असली लोगों या पूरी तरह निष्पक्ष प्रतियोगिता का प्रमाण नहीं है।')}</p>
    </>}
  </section>;
}

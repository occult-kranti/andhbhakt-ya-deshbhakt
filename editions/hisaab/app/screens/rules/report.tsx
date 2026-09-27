/**
 * screens/rules/report.tsx — "Report an error in a question" (design bible §11.17 primary).
 *
 * No server: the report is a prefilled text. The primary opens a prefilled issue on the project's
 * public GitHub tracker in a new tab; "Copy the report" puts the same text on the clipboard. When the
 * owner publishes a corrections address in CORRECTIONS_EMAIL, a mail-draft button appears, the fine
 * print names the address, and Rules §10 prints it for anyone named in a question (the private route
 * for a right of reply, charter §2.3). Until then the copy says plainly that GitHub is the only, public,
 * route. Nothing is sent from the app itself. Confirmations are inline.
 */
import { useId, useState } from 'react';
import { ClipboardCopy, ExternalLink, Mail } from 'lucide-react';
import { EDITION } from '../../../edition';
import { itemById, statusWithAsOf } from '../../data';
import { absoluteUrl, href } from '../../router';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';

/** The public issue tracker of the repository the site is published from. */
export const ISSUES_NEW_URL = 'https://github.com/occult-kranti/andhbhakt-ya-deshbhakt/issues/new';
/**
 * A corrections mailbox, if the owner publishes one (null = no mail button, and the page says there is
 * no private address yet). Only the owner sets this: it is printed on a public page.
 */
export const CORRECTIONS_EMAIL: string | null = null;

const REASONS = [
  { id: 'answer', en: 'The answer is wrong', hi: 'जवाब ग़लत है' },
  { id: 'status', en: 'The legal status is out of date', hi: 'क़ानूनी स्थिति पुरानी है' },
  { id: 'source', en: "The source doesn't say this", hi: 'स्रोत में यह नहीं लिखा' },
  { id: 'unfair', en: 'It is unfair to someone, or one-sided', hi: 'किसी के साथ अन्याय या एकतरफ़ा' },
  { id: 'reply', en: 'I am named in this question — my reply', hi: 'इस सवाल में मेरा नाम है — मेरा जवाब' },
  { id: 'other', en: 'Something else', hi: 'कुछ और' },
] as const;

export function reportText(input: { id: string; reason: string; details: string; source: string }): { title: string; body: string } {
  const item = itemById(input.id.trim().toLowerCase());
  const reason = REASONS.find((r) => r.id === input.reason)?.en ?? 'Something else';
  const title = `Correction: ${item ? item.id : input.id.trim() || 'a question'} — ${reason}`;
  const lines = [
    `Andhbhakt ya Deshbhakt correction report`,
    ``,
    `Item: ${item ? item.id : input.id.trim() || '(not given)'}`,
  ];
  if (item) {
    lines.push(`Question: ${item.question}`);
    lines.push(`Answer shown: ${item.options[item.correctIndex]}`);
    const status = statusWithAsOf(item);
    if (status) lines.push(`Status shown: ${status}`);
    lines.push(`Source shown: ${item.sourceLabel} ${item.sourceUrl}`);
    lines.push(`Link: ${absoluteUrl(href.taster(item.id), EDITION.base)}`);
  }
  const reply = input.reason === 'reply';
  lines.push(
    ``,
    `What is wrong: ${reason}`,
    `${reply ? 'Reply' : 'Details'}: ${input.details.trim() || '(none)'}`,
    `${reply ? 'A source for it' : 'Your source'}: ${input.source.trim() || '(none)'}`,
  );
  lines.push(``, `(Filed from the Rules page. Please do not include personal details about private people.)`);
  return { title, body: lines.join('\n') };
}

export function ReportForm({ initialId }: { initialId: string }) {
  const { t } = useLang();
  const ids = { id: useId(), reason: useId(), details: useId(), source: useId() };
  const [id, setId] = useState(initialId);
  const [reason, setReason] = useState<string>(initialId ? 'status' : 'answer');
  const [details, setDetails] = useState('');
  const [source, setSource] = useState('');
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const item = itemById(id.trim().toLowerCase());
  const { title, body } = reportText({ id, reason, details, source });
  const issueUrl = `${ISSUES_NEW_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${body}`);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <form className="h-report" onSubmit={(e) => e.preventDefault()} aria-label={t('Report an error', 'ग़लती बताओ')}>
      <div className="h-report__field">
        <label htmlFor={ids.id} className="h-report__label">
          {t('Question id', 'सवाल की आईडी')} <span className="h-report__opt">{t('(on every receipt, e.g. hsc001)', '(हर रसीद पर, जैसे hsc001)')}</span>
        </label>
        <input id={ids.id} className="h-report__input" value={id} onChange={(e) => setId(e.target.value.slice(0, 12))} autoComplete="off" spellCheck={false} inputMode="text" />
        {id.trim() ? (
          <p className="h-report__match" aria-live="polite">
            {item ? item.question : t('No question with that id in this build — describe it below instead.', 'इस आईडी का कोई सवाल नहीं — नीचे बताइए।')}
          </p>
        ) : null}
      </div>
      <div className="h-report__field">
        <label htmlFor={ids.reason} className="h-report__label">
          {t('What is wrong', 'क्या ग़लत है')}
        </label>
        <select id={ids.reason} className="h-report__input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {t(r.en, r.hi)}
            </option>
          ))}
        </select>
      </div>
      <div className="h-report__field">
        <label htmlFor={ids.details} className="h-report__label">
          {t('Details', 'विवरण')}
        </label>
        <textarea
          id={ids.details}
          className="h-report__input h-report__area"
          rows={4}
          maxLength={800}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={
            reason === 'reply'
              ? t('Your reply, in a sentence or two', 'आपका जवाब, एक-दो वाक्य में')
              : t('What should it say, as of when?', 'क्या लिखा होना चाहिए, किस तारीख़ तक?')
          }
        />
      </div>
      <div className="h-report__field">
        <label htmlFor={ids.source} className="h-report__label">
          {t('Your source (a link)', 'आपका स्रोत (लिंक)')} <span className="h-report__opt">{t('(optional)', '(वैकल्पिक)')}</span>
        </label>
        <input id={ids.source} className="h-report__input" type="url" inputMode="url" value={source} onChange={(e) => setSource(e.target.value.slice(0, 400))} placeholder="https://" />
      </div>
      <div className="h-report__actions">
        <Button variant="primary" href={issueUrl} target="_blank" rel="noopener noreferrer" icon={<ExternalLink size={20} strokeWidth={2.4} />}>
          {t('Report an error in a question', 'सवाल में ग़लती बताओ')}
        </Button>
        <Button variant="paper" icon={<ClipboardCopy size={20} strokeWidth={2.4} />} onClick={() => void copy()}>
          <span aria-live="polite">
            {copied === 'done' ? t('Copied ✓', 'कॉपी हो गया ✓') : copied === 'failed' ? t('Could not copy — select the text below', 'कॉपी नहीं हुआ — नीचे से चुनें') : t('Copy the report', 'रिपोर्ट कॉपी करो')}
          </span>
        </Button>
        {CORRECTIONS_EMAIL ? (
          <Button
            variant="paper"
            href={`mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`}
            icon={<Mail size={20} strokeWidth={2.4} />}
          >
            {t('Mail draft', 'मेल ड्राफ़्ट')}
          </Button>
        ) : null}
      </div>
      <p className="h-report__fine">
        {CORRECTIONS_EMAIL ? (
          <>
            {t(
              'The first button opens a public issue on GitHub (a free account is needed), already filled in. To write privately instead — or with no GitHub account — copy the report and mail it to ',
              'पहला बटन GitHub पर सार्वजनिक इश्यू खोलता है (खाता चाहिए)। निजी तौर पर लिखना हो, या खाता न हो, तो रिपोर्ट कॉपी करके यहाँ मेल करें: ',
            )}
            <a className="h-link" href={`mailto:${CORRECTIONS_EMAIL}`} lang="en">
              {CORRECTIONS_EMAIL}
            </a>
            {t('. Nothing is sent from this app, and nothing is stored about you.', '। ऐप से कुछ नहीं भेजा जाता।')}
          </>
        ) : (
          t(
            'The first button opens a public issue on GitHub (a free account is needed), already filled in — anyone can read it. For now that is the only way to reach us; there is no private address yet. Nothing is sent from this app, and nothing is stored about you.',
            'पहला बटन GitHub पर सार्वजनिक इश्यू खोलता है (खाता चाहिए) — इसे कोई भी पढ़ सकता है। अभी हम तक पहुँचने का यही रास्ता है; कोई निजी पता अभी नहीं है। ऐप से कुछ नहीं भेजा जाता।',
          )
        )}
      </p>
      <details className="h-report__preview">
        <summary className="h-report__previewsum">{t('See the report text', 'रिपोर्ट का टेक्स्ट देखो')}</summary>
        <pre className="h-report__pre">{`${title}\n\n${body}`}</pre>
      </details>
    </form>
  );
}

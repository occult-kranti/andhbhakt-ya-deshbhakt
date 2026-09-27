/** A prepared empty state for unpublished practice files. Internal pool counts stay private. */
import { useId, type ReactNode } from 'react';
import { Keyboard } from 'lucide-react';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Tape } from '../../ui/tape';
import '../../ui/file-card.css';
import './typing.css';

export const TYPING_LINE = 'These files are being typed. Babu will file them soon.';
export const TYPING_LINE_HI = 'ये फ़ाइलें टाइप हो रही हैं। बाबू जल्द फ़ाइल करेंगे।';

export type TypingFileProps = {
  fno: string;
  title: ReactNode;
  titleHi?: string;
  /** Cards on file so far (the real count). */
  pool: number;
  /** One action under the line (at most one primary per screen — the caller decides). */
  action?: ReactNode;
  className?: string;
};

export function TypingFile({ fno, title, titleHi, action, className }: TypingFileProps) {
  const { t } = useLang();
  const headId = useId();
  const count = t('This file is being prepared. Try another file while it is checked.', 'यह फ़ाइल तैयार हो रही है। तब तक दूसरी फ़ाइल देखें।');
  return (
    <section className={cx('h-file', 'h-file--sealed', 'h-typefile', className)} aria-labelledby={headId}>
      <span className="h-file__tab">{fno}</span>
      <div className="h-typefile__head">
        <span className="h-typefile__icon" aria-hidden="true">
          <Keyboard size={24} strokeWidth={2.2} />
        </span>
        <div className="h-typefile__titles">
          {titleHi ? (
            <p className="h-typefile__hi" lang="hi">
              {titleHi}
            </p>
          ) : null}
          <h2 className="h-typefile__title" id={headId}>
            {title}
          </h2>
        </div>
      </div>
      <p className="h-typefile__line">{t(TYPING_LINE, TYPING_LINE_HI)}</p>
      <div className="h-typefile__sheet" aria-hidden="true">
        <span className="h-typefile__caret" />
      </div>
      <p className="h-typefile__count">{count}</p>
      <Tape />
      {action ? <div className="h-typefile__action">{action}</div> : null}
    </section>
  );
}

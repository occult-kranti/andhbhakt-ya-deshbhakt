/** Own answer feedback may be shown while the opponent's independent turn is still open. */
import { useEffect, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { itemById } from '../../data';
import { useLang } from '../../ui/lang';
import { Receipt } from '../../ui/receipt';
import { NotingSheet } from '../../ui/noting-sheet';
import { RoundHead } from './live';
import { other, seconds, type Room } from './lib';
import './personal-receipt.css';

export function PersonalReceipt({ room, names, onSettings, banner, onSay }: {
  room: Room;
  names: readonly [string, string];
  onSettings: () => void;
  banner?: ReactNode;
  onSay: (text: string) => void;
}) {
  const { t } = useLang();
  const answer = room.round!.personalReceipt!;
  const q = answer.question;
  const item = itemById(q.factId ?? null);
  const rival = names[other(room.seat)];
  const verdict = answer.correct ? t('Correct answer', 'सही जवाब') : t('Incorrect answer', 'ग़लत जवाब');
  useEffect(() => {
    onSay(t(`Your answer: ${answer.correct ? 'correct' : 'incorrect'}. ${rival} is still answering.`, `आपका जवाब ${answer.correct ? 'सही' : 'ग़लत'}। ${rival} अभी जवाब दे रहा है।`));
    // One announcement for this answer; this component is keyed by its round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section className="h-personal-receipt">
    <RoundHead room={room} names={names} onSettings={onSettings} sub={t(`Round ${room.roundIndex + 1} · your answer`, `राउंड ${room.roundIndex + 1} · आपका जवाब`)} />
    {banner}
    <div className="h-personal-receipt__body">
      <div className="h-personal-receipt__verdict" data-correct={answer.correct}>
        <p>{t('Your answer', 'आपका जवाब')}</p>
        <h1 tabIndex={-1} data-autofocus>
          {answer.correct ? <Check aria-hidden="true" size={28} /> : <X aria-hidden="true" size={28} />}
          {verdict}
        </h1>
        <p>{t(`Stopwatch stopped at ${seconds(answer.elapsedMs)}.`, `स्टॉपवॉच ${seconds(answer.elapsedMs)} पर रुकी।`)}</p>
      </div>
      <div className="h-personal-receipt__pending">
        <strong>{t(`${rival} is still answering.`, `${rival} अभी जवाब दे रहा है।`)}</strong>
        <p>{t('Your answer is final. The round score appears when both answers are in or the answer window closes.', 'आपका जवाब लॉक है। दोनों जवाब आने पर या समय सीमा ख़त्म होने पर राउंड का स्कोर आएगा।')}</p>
      </div>
      <h2 className="h-personal-receipt__question" lang="en">{q.question}</h2>
      <dl className="h-personal-receipt__picks">
        <div><dt>{t('Your pick', 'आपका चुनाव')}</dt><dd lang="en">{q.options[answer.choice]}</dd></div>
        {!answer.correct && typeof q.correctIndex === 'number' ? <div><dt>{t('Correct answer', 'सही जवाब')}</dt><dd lang="en">{q.options[q.correctIndex]}</dd></div> : null}
      </dl>
      <Receipt item={item} label={t('Answer source', 'जवाब का स्रोत')} extra={!item && q.sourceUrl ? [['SOURCE', <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer">{q.sourceLabel ?? q.sourceUrl}</a>]] : undefined} />
      {q.explanation ? <NotingSheet title={t('Why this answer', 'यह जवाब क्यों')}><p lang="en">{q.explanation}</p></NotingSheet> : null}
    </div>
  </section>;
}

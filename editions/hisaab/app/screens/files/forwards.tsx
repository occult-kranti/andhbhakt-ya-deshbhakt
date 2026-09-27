/**
 * screens/files/forwards.tsx — Forward Court (bible §11.6): the court file and the docket.
 *
 * The court file (route `forward-court`) holds the ONE primary action, "Court is in session". The
 * docket lists every forward on file (kind 'forward', claims from every side): pending cases show the
 * claim — question text only — in a generic paper bubble tagged "Forwarded many times" (never a
 * messenger's green, ticks or chrome) and link to that card's one-card taster; a case opens once the
 * player has answered it, with the fact-checkers' ruling, the checker's name and the receipt rows.
 */
import { useMemo } from 'react';
import { CornerUpRight } from 'lucide-react';
import { routesOfKind } from '../../../edition';
import type { AppRoute } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { FileBrief } from './brief';
import {
  bestText,
  CARDS,
  claimOf,
  distinctSorted,
  fileStatus,
  forwardItems,
  routeItems,
  sourceName,
  usePlayerFiles,
} from './lib';
import { ClaimOnTrialChip, Register, RegisterField, type RegisterEntry } from './register';
import { FilesTabs } from './tabs';
import { TypingFile } from './typing';
import './forwards.css';

export function ForwardsView(_: { route: AppRoute }) {
  const { t } = useLang();
  useScreenTitle('Forward Court');
  const { journeys, held, loaded } = usePlayerFiles();
  const court = routesOfKind('forward')[0] ?? null;
  const status = fileStatus(court, journeys);
  const cards = useMemo(() => (court ? routeItems(court) : []), [court]);
  const all = useMemo(() => forwardItems(), []);
  const checkers = useMemo(() => distinctSorted(cards.map(sourceName)), [cards]);
  /** The claim the court hears next: the open run's next card, else the file's first card. */
  const next = cards[status.running ? Math.min(status.done, cards.length - 1) : 0] ?? null;
  const nextClaim = next ? claimOf(next) : null;

  const entries = useMemo<RegisterEntry[]>(
    () =>
      all.map((item) => {
        const claim = claimOf(item);
        return {
          item,
          kicker: `${item.year}`,
          sealedTitle: claim,
          title: item.subtopic,
          body: (
            <>
              {claim ? (
                <RegisterField k={t('Claim', 'दावा')}>
                  <p>{claim}</p>
                </RegisterField>
              ) : null}
              <RegisterField k={t('Ruling', 'फ़ैसला')}>
                <p className="h-fwd__ruling">{item.options[item.correctIndex]}</p>
              </RegisterField>
              <p className="h-fwd__noting">{item.explanation}</p>
            </>
          ),
        };
      }),
    [all, t],
  );

  return (
    <Page screen="files-forwards" className="h-fwd">
      <FilesTabs current="forwards" />
      <ScreenHeader
        kicker="F.No. COURT/FWD"
        titleHi="फ़ॉरवर्ड अदालत"
        title="Forward Court"
        lead={t('Claims from every side. Rulings by fact-checkers.', 'हर तरफ़ के दावे। फ़ैसला फ़ैक्ट-चेकर्स का।')}
      />
      <p className="h-quip h-fwd__quip">{t('Forward aaya? Pehle receipt.', 'फ़ॉरवर्ड आया? पहले रसीद।')}</p>

      <div className="h-fwd__layout">
        <div className="h-fwd__file">
          {court ? (
            <FileBrief
              route={court}
              status={status}
              loaded={loaded}
              kicker={t('Court file', 'अदालत की फ़ाइल')}
              titleHi="फ़ॉरवर्ड अदालत"
              title="Forward Court"
              openLabel={t('Court is in session', 'अदालत शुरू')}
              lead={
                nextClaim && status.state !== 'cleared' ? (
                  <>
                    <p>{status.running ? t('Next case:', 'अगला मामला:') : t('First case:', 'पहला मामला:')}</p>
                    <blockquote className="h-fwd__bubble">
                      <span className="h-reg__bubblehead">
                        <span className="h-fwd__fwd">
                          <CornerUpRight size={14} strokeWidth={2.6} aria-hidden="true" />
                          Forwarded many times
                        </span>
                        <ClaimOnTrialChip />
                      </span>
                      <span className="h-fwd__claim">{nextClaim}</span>
                    </blockquote>
                  </>
                ) : null
              }
              facts={[
                { k: t('Cases', 'मामले'), v: `${CARDS} ${t('cards', 'कार्ड')}` },
                { k: t('Sources', 'स्रोत'), v: checkers.join(' · ') },
                ...(status.best ? [{ k: t('Best', 'सर्वश्रेष्ठ'), v: <span className="h-mono">{bestText(status.best).replace(/^Best /, '')}</span> }] : []),
              ]}
            />
          ) : (
            <TypingFile fno="F.No. COURT/FWD" title="Forward Court" titleHi="फ़ॉरवर्ड अदालत" pool={all.length} />
          )}
        </div>

        <Register
          className="h-fwd__docket"
          title="The docket"
          titleHi="मुक़दमों की सूची"
          lead={t(
            'Every forward on file, from every side. A ruling opens once you have heard the case.',
            'हर तरफ़ के सभी फ़ॉरवर्ड। मामला सुनो, तब फ़ैसला खुलेगा।',
          )}
          entries={entries}
          held={held}
          sealedStyle="bubble"
          sealedLimit={4}
          sealedCta={t('Hear the case', 'मामला सुनो')}
          emptyLine={t('No rulings filed yet. Hear a case and the fact-checkers’ ruling is filed here.', 'अभी कोई फ़ैसला दर्ज नहीं। मामला सुनो, फ़ैसला यहाँ दर्ज होगा।')}
          doneLine={t('No forwards left on the docket. Rare.', 'डॉकेट पर कोई फ़ॉरवर्ड बाक़ी नहीं। दुर्लभ।')}
        />
      </div>
    </Page>
  );
}

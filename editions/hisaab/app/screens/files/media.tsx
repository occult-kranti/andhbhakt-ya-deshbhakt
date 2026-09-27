/**
 * screens/files/media.tsx — Kiska Media? (bible §11.5): the press file and a compact "who owns what"
 * register.
 *
 * The press file (route `kiska-media`) holds the screen's ONE primary action, "Open the press file".
 * The register is built from Media & Speech items that the lane files as ownership or political-link
 * facts (lib.ts ownershipItems) — ownership facts only, across groups and parties. Outlet names are
 * plain mono text chips: no logos, masthead lettering or brand colours. Each entry stays sealed until
 * its card is answered (the entry IS the answer), then prints the bank's explanation verbatim with the
 * legal status and its as-of date.
 */
import { useMemo } from 'react';
import { routesOfKind } from '../../../edition';
import type { AppRoute } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { FileBrief } from './brief';
import { bestText, CARDS, distinctSorted, fileStatus, ownershipItems, placeYear, routeItems, sealedName, usePlayerFiles } from './lib';
import { Register, type RegisterEntry } from './register';
import { FilesTabs } from './tabs';
import { TypingFile } from './typing';
import './media.css';

export function MediaView(_: { route: AppRoute }) {
  const { t } = useLang();
  useScreenTitle('Kiska Media?');
  const { journeys, held, loaded } = usePlayerFiles();
  const press = routesOfKind('media')[0] ?? null;
  const status = fileStatus(press, journeys);
  const cards = useMemo(() => (press ? routeItems(press) : []), [press]);
  const outlets = useMemo(() => distinctSorted(cards.map((q) => sealedName(q) ?? '')), [cards]);
  const entries = useMemo<RegisterEntry[]>(
    () =>
      ownershipItems().map((item) => ({
        item,
        kicker: placeYear(item),
        sealedTitle: sealedName(item),
        title: item.subtopic,
        body: <p className="h-media__fact">{item.explanation}</p>,
      })),
    [],
  );

  return (
    <Page screen="files-media" className="h-media">
      <FilesTabs current="media" />
      <ScreenHeader
        kicker={`F.No. M/PRESS · ${t('Media & Speech', 'मीडिया और अभिव्यक्ति')}`}
        titleHi="किसका मीडिया?"
        title="Kiska Media?"
        lead={t('Who owns the news that told you?', 'जिस ख़बर ने बताया, वो किसकी है?')}
      />
      <p className="h-quip h-media__quip">
        {t('Channel kiska, paisa kiska.', 'चैनल किसका, पैसा किसका।')} <span className="h-media__quipnote">{t('Ownership facts across groups and parties.', 'हर समूह, हर पार्टी के मालिकाना तथ्य।')}</span>
      </p>

      <div className="h-media__layout">
        <div className="h-media__file">
          {press ? (
            <FileBrief
              route={press}
              status={status}
              loaded={loaded}
              kicker={t('Press file', 'प्रेस फ़ाइल')}
              titleHi="किसका मीडिया?"
              title="Kiska Media?"
              openLabel={t('Open the press file', 'प्रेस फ़ाइल खोलो')}
              lead={
                outlets.length ? (
                  <>
                    <p>{t('In this file:', 'इस फ़ाइल में:')}</p>
                    <ul className="h-media__outlets" aria-label={t('Outlets and cases in this file', 'इस फ़ाइल के आउटलेट और मामले')}>
                      {outlets.map((o) => (
                        <li key={o} className="h-media__outlet">
                          {o}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null
              }
              facts={[
                { k: t('Cards', 'कार्ड'), v: `${CARDS} ${t('cards', 'कार्ड')}` },
                { k: t('Chapters', 'अध्याय'), v: press.chapters.join(' → ') },
                ...(status.best ? [{ k: t('Best', 'सर्वश्रेष्ठ'), v: <span className="h-mono">{bestText(status.best).replace(/^Best /, '')}</span> }] : []),
              ]}
            />
          ) : (
            <TypingFile fno="F.No. KISKA/MEDIA" title="Kiska Media?" titleHi="किसका मीडिया?" pool={cards.length} />
          )}
        </div>

        <Register
          className="h-media__register"
          title="Who owns what"
          titleHi="कौन किसका मालिक"
          lead={t(
            'Ownership facts from filings, reports and ownership monitors. An entry opens once you have answered its card — the owner is the answer.',
            'फ़ाइलिंग, रिपोर्ट और ओनरशिप मॉनिटर से मालिकाना तथ्य। कार्ड का जवाब दो, तब प्रविष्टि खुलेगी — मालिक ही जवाब है।',
          )}
          entries={entries}
          held={held}
          sealedStyle="chip"
          sealedLimit={entries.length}
          sealedCta={t('Answer this card to open the entry', 'इस कार्ड का जवाब दो')}
          emptyLine={t('Register khaali hai. Answer a press card and its owner is filed here.', 'रजिस्टर ख़ाली है। प्रेस कार्ड का जवाब दो, मालिक यहाँ दर्ज होगा।')}
          doneLine={t('Every owner on file. Ab poocho: paisa kiska?', 'हर मालिक दर्ज। अब पूछो: पैसा किसका?')}
        />
      </div>
    </Page>
  );
}

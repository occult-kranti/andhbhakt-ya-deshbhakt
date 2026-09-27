/**
 * ui/gallery.tsx — the component gallery at #/dev/ui (never linked). Every ui/ and three/ piece in
 * its states, for the foundation's screenshots and for screen engineers to eyeball against the bible.
 * Not a product screen: it breaks the one-primary rule on purpose to show the variants.
 */
import { useState, type ReactNode } from 'react';
import { FolderOpen, Landmark } from 'lucide-react';
import { useBudget } from '../budget';
import { BANK_ITEMS, goalCopy, bandProgress, itemById } from '../data';
import type { ScreenProps } from '../router';
import { FilePile, Tarazu, Thappa, Tijori } from '../three';
import { Button } from './button';
import { Certificate } from './certificate';
import { Chip, GovtChip, LegalStatus, SourceChip } from './chip';
import { FileCard } from './file-card';
import { Meter } from './meter';
import { NotingSheet } from './noting-sheet';
import { Option, OptionList } from './option';
import { Page, ScreenHeader, EmptyState, ErrorState } from './page';
import { Poster } from './poster';
import { Receipt } from './receipt';
import { Skeleton } from './skeleton';
import { Stamp } from './stamp';
import { Tile } from './tile';
import './gallery.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="h-gal__section">
      <h2 className="h-gal__title">{title}</h2>
      {children}
    </section>
  );
}

export default function Gallery({ route }: ScreenProps) {
  const budget = useBudget();
  const [chosen, setChosen] = useState<number | null>(null);
  const withStatus = BANK_ITEMS.find((q) => q.status && q.status.length > 150) ?? BANK_ITEMS[0];
  const plain = itemById('hsc001') ?? BANK_ITEMS[1];
  const xp = 2150;
  const band = bandProgress(xp);
  return (
    <Page screen={`dev-${route.view}`}>
      <ScreenHeader kicker="F.No. DEV/UI" titleHi="नमूने" title="Component gallery" lead="Every LAL FEETA component in its states." />
      <Poster hi="जनता का पैसा।" en="Janta ka sawaal." swipe="sawaal" as="p" size="l" />

      <Section title="Buttons">
        <div className="h-row">
          <Button variant="primary">Open today&apos;s file</Button>
          <Button variant="paper" icon={<FolderOpen size={20} />}>
            All files
          </Button>
          <Button variant="ghost">Not now</Button>
          <Button variant="paper" disabled>
            Disabled
          </Button>
          <Button variant="paper" size="s">
            Small
          </Button>
        </div>
      </Section>

      <Section title="Files">
        <div className="h-grid">
          <FileCard fno="F.No. S/UP" title="Uttar Pradesh" titleHi="उत्तर प्रदेश" meta="6 cards · 3 sectors" state="sealed" href="#/dev/ui" />
          <FileCard
            fno="F.No. D/2026-09-25"
            title="Today's file"
            meta="5 questions · same for everyone today"
            state="open"
            emphasis
            icon={<Landmark size={24} />}
            progress={{ value: 2, max: 5, label: '2 of 5 answered', copy: '2 of 5 answered' }}
            onClick={() => {}}
          />
          <FileCard fno="F.No. X/WELFARE" title="Welfare & Subsidies" meta="Best 18/24" state="cleared" href="#/dev/ui" />
        </div>
      </Section>

      <Section title="Answers (h-opt)">
        <div className="h-gal__two">
          <OptionList
            options={['Comptroller and Auditor General', 'Election Commission of India', 'Reserve Bank of India', 'Central Vigilance Commission']}
            chosen={chosen}
            onChoose={setChosen}
            keys={false}
          />
          <div className="h-optlist">
            <Option index={0} label="Locked pick" state="locked" />
            <Option index={1} label="Correct, your pick" state="correct" />
            <Option index={2} label="Your pick, wrong" state="wrong-chosen" />
            <Option index={3} label="Correct, not picked" state="correct-unchosen" />
            <Option index={0} label="Everything else" state="other" />
          </div>
        </div>
      </Section>

      <Section title="Stamps">
        <div className="h-row h-gal__stamps">
          <Stamp kind="pass" seed="a1" />
          <Stamp kind="fail" seed="b2" />
          <Stamp kind="wait" seed="c3" />
          <Stamp kind="noted" seed="d4" text="ISSUED · 25 SEP 2026" />
          <Stamp kind="pass" seed="e5" size="s" />
        </div>
      </Section>

      <Section title="Receipt + noting">
        <div className="h-gal__two">
          <Receipt item={withStatus} receiptNo={215} xp={30} xpNote="Correct · under 8 seconds" />
          <div className="h-stack">
            <NotingSheet hand="Noted. Pl. forward.">
              <p>{withStatus.explanation}</p>
            </NotingSheet>
            <NotingSheet collapsible>
              <p>{plain.explanation}</p>
            </NotingSheet>
          </div>
        </div>
      </Section>

      <Section title="Chips, meter, legal">
        <div className="h-row">
          <SourceChip kind="CAG" />
          <SourceChip kind="COURT" />
          <SourceChip kind="PRESS" />
          <GovtChip govt="NDA" />
          <GovtChip govt="UPA" />
          <Chip kind="kind">scheme</Chip>
        </div>
        <LegalStatus status={withStatus.status ?? 'No status'} asOf={withStatus.asOf} />
        <Meter value={band.value} max={band.max} ticks={5} label="Progress in this band" copy={goalCopy(xp)} />
      </Section>

      <Section title="Cartogram tiles">
        <div className="h-gal__tiles">
          <Tile code="UP" name="Uttar Pradesh" state="sealed" />
          <Tile code="BR" name="Bihar" state="progress" progress={{ done: 3, total: 6 }} />
          <Tile code="KL" name="Kerala" state="cleared" />
          <Tile code="TN" name="Tamil Nadu" state="progress" progress={{ done: 1, total: 6 }} selected />
          <Tile code="AS" name="Assam" state="sealed" showName />
        </div>
      </Section>

      <Section title="Set pieces (2D fallbacks)">
        <div className="h-grid">
          <Tijori count={214} newCount={3} />
          <Tarazu scores={[2, 1]} names={['You', 'Babu-Bot · BOT']} winner={0} />
          <Thappa text="ISSUED · RECEIPT MAANGO" kind="noted" />
          <FilePile results={['pass', 'pass', 'fail', 'pass', 'wait', 'pass']} title="Uttar Pradesh" score={{ got: 18, max: 24 }} />
        </div>
      </Section>

      <Section title="Certificate">
        <Certificate name="Asha" receipts={214} band={4} issuedOn={new Date(2026, 8, 25)} />
        <Certificate name="Narendra Modi" receipts={9} band={0} issuedOn={new Date(2026, 8, 25)} />
      </Section>

      <Section title="States">
        <EmptyState line="Tijori khaali hai. First receipt goes here." action={<Button variant="paper" size="s">Open today&apos;s file</Button>} />
        <ErrorState onRetry={() => {}} />
        <Skeleton lines={3} />
      </Section>

      <Section title="Budget">
        <div className="h-row">
          <Button variant="paper" size="s" onClick={() => budget.toast({ title: 'Quest done', body: 'Answer 3 questions', tone: 'quest' })}>
            Toast
          </Button>
          <Button variant="paper" size="s" onClick={() => budget.toast({ title: 'Second toast (merges or goes to Activity)' })}>
            Toast again
          </Button>
          <Button
            variant="paper"
            size="s"
            onClick={() => {
              budget.ceremony({ kind: 'file', kicker: 'File cleared', title: 'Uttar Pradesh ki file clear.', stamp: 'FILE CLEARED · 18/24', seed: 'up' });
              budget.ceremony({ kind: 'label', kicker: 'Label promotion', title: 'Receipt Maango', titleHi: 'रसीद माँगो', subtitle: 'Has started asking for the bill.', stamp: 'ISSUED · RECEIPT MAANGO', seed: 'band-4' });
            }}
          >
            Label + file ceremony
          </Button>
        </div>
      </Section>
    </Page>
  );
}

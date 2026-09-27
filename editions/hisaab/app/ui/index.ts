/**
 * ui/index.ts — the LAL FEETA component library (design bible §5). One CSS file per component,
 * `h-` classes, `--h-` tokens only. Import from here:
 *
 *   import { Button, FileCard, OptionList, Receipt, Stamp, Page, ScreenHeader } from '@/editions/hisaab/app/ui';
 *
 * Props are documented on each component and in app/README.md.
 */
export { Button, IconButton, buttonClass, type ButtonProps, type ButtonVariant, type ButtonSize, type IconButtonProps } from './button';
export { FileCard, type FileCardProps, type FileState } from './file-card';
export { Tape, type TapeProps } from './tape';
export { focusWithin, Option, OptionList, OptionShape, optionState, OPTION_SLOTS, QUESTION_SCOPE, questionScope, type OptionProps, type OptionListProps, type OptionState, type OptionIndex } from './option';
export { Stamp, STAMP_WORDS, type StampProps, type StampKind } from './stamp';
export { Receipt, receiptNumber, type ReceiptProps } from './receipt';
export { NotingSheet, type NotingSheetProps } from './noting-sheet';
export { Chip, SourceChip, GovtChip, LegalStatus, type ChipKind, type LegalStatusProps } from './chip';
export { Meter, type MeterProps } from './meter';
export { Tile, tileLabel, type TileProps, type TileState } from './tile';
export { Certificate, certificateDate, CERT_FOOTER, CERT_SITE, type CertificateProps } from './certificate';
export { ToastHost } from './toast';
export { CeremonyHost } from './ceremony';
export { Skeleton } from './skeleton';
export { Poster, type PosterProps } from './poster';
export { Page, ScreenHeader, EmptyState, ErrorState, InlineNote, type PageProps, type ScreenHeaderProps } from './page';
export { Hi, Kicker, Mono, SrOnly } from './text';
export { useLang, type Locale } from './lang';
export { loadHandFont } from './fonts';
export { stampAngle, hash32 } from './seed';
export { cx } from './cx';

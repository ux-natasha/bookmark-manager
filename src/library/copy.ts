import type { Theme } from '../lib/theme';

// Words that change with the theme. Only the words: the actions behind them are the same.
// Keep both themes' strings here so the verbs aren't scattered through components.
interface Copy {
  headline: [plain: string, italic: string];
  // Contact sheet sets the italic part on its own line.
  headlineBreak: boolean;
  filedUnderLead: string;
  emptyTitle: string;
  noResults: string;
  itemNoun: [singular: string, plural: string];
  index: IndexCopy;
}

// The tag strip and index (docs/design/library-interactions.md 6.5–6.7; Contact sheet 4.6, 4.8; Covers 5, 6.5, 6.6).
interface IndexCopy {
  stripLead: string;
  open: string;
  hint: string;
  tidyLead: string;
  // Off, 3 months, 6 months, a year.
  tidyOptions: [string, string, string, string];
  // "31 tags haven't been used in a year"
  staleLine: (count: number, span: string) => string;
  staleExplainer: string;
  archive: (count: number) => string;
  archivedLine: (count: number) => string;
  bringBack: string;
  archivedToast: (count: number) => string;
  onceLabel: string;
  // Shown in the open index when every tag has been archived.
  allArchived: string;
}

const SPANS: Record<number, string> = { 3: '3 months', 6: '6 months', 12: 'a year' };

export function tidySpan(months: number): string {
  return SPANS[months] ?? `${months} months`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const DEFAULT_INDEX: IndexCopy = {
  stripLead: 'Most used',
  open: 'Open the index',
  hint: 'Picking a tag closes the index. Shift-click to pick several.',
  tidyLead: 'Tidy up tags not used in',
  tidyOptions: ['Off', '3 months', '6 months', 'a year'],
  staleLine: (n, span) => `${plural(n, 'tag')} ${n === 1 ? 'hasn’t' : 'haven’t'} been used in ${span}`,
  staleExplainer: 'They’re shaded below. Archived tags leave the index but stay on the things they’re on.',
  archive: (n) => `Archive ${n}`,
  archivedLine: (n) => `Archived ${plural(n, 'tag')}.`,
  bringBack: 'Bring them back',
  archivedToast: (n) => `Archived ${plural(n, 'tag')}`,
  onceLabel: 'Once · ',
  allArchived: 'Every tag is archived. Bring them back below.',
};

const COPY: Record<Theme, Copy> = {
  default: {
    headline: ['Everything you ', 'kept'],
    headlineBreak: false,
    filedUnderLead: 'Showing things filed under',
    emptyTitle: 'Nothing saved yet',
    noResults: 'Nothing you kept matches that, yet.',
    itemNoun: ['item', 'items'],
    index: DEFAULT_INDEX,
  },
  contact: {
    headline: ['Everything you kept,', 'on one sheet'],
    headlineBreak: true,
    filedUnderLead: 'Showing frames filed under',
    emptyTitle: 'Nothing exposed yet',
    noResults: 'No frame on the sheet matches that, yet.',
    itemNoun: ['frame', 'frames'],
    index: {
      ...DEFAULT_INDEX,
      hint: 'Picking closes the index · Shift-click for several',
      tidyOptions: ['Off', '3 mo', '6 mo', 'A year'],
      staleLine: (n, span) => `${plural(n, 'tag')} unused for ${span}`,
      staleExplainer: 'Their letters are tinted below. Archived tags leave the index but stay on the things they’re on.',
    },
  },
  covers: {
    headline: ['Everything you ', 'kept'],
    headlineBreak: false,
    filedUnderLead: 'Showing things filed under',
    emptyTitle: 'The shelf is empty',
    noResults: 'Nothing on the shelf matches that, yet.',
    itemNoun: ['cover', 'covers'],
    index: {
      ...DEFAULT_INDEX,
      stripLead: 'Index',
      open: 'Turn to the index',
      tidyLead: 'Leave out of the next edition: tags unused for',
      staleLine: (n, span) =>
        `${plural(n, 'tag')} marked † ${n === 1 ? 'hasn’t' : 'haven’t'} been used in ${span}. Leave ${n === 1 ? 'it' : 'them'} out of the next edition?`,
      staleExplainer: 'They stay on the things they’re on.',
      archive: (n) => `Leave out ${n}`,
      archivedLine: (n) => `${plural(n, 'tag')} out of print.`,
      bringBack: 'Bring them all back',
      archivedToast: (n) => `${plural(n, 'tag')} left out of the next edition`,
      onceLabel: 'once: ',
      allArchived: 'Every tag is out of print. Bring them back below.',
    },
  },
};

export function copyFor(theme: Theme): Copy {
  return COPY[theme];
}

import type { Theme } from '../lib/theme';

// Words that change with the theme. Only the words: the actions behind them are the same.
// Keep every theme's strings here so the verbs aren't scattered through components.
interface Copy {
  headline: [plain: string, italic: string];
  // Contact sheet sets the italic part on its own line.
  headlineBreak: boolean;
  filedUnderLead: string;
  emptyTitle: string;
  noResults: string;
  itemNoun: [singular: string, plural: string];
  index: IndexCopy;
  ageing: AgeingCopy;
}

// Look ahead, and bringing faded things back (docs/design/library-interactions.md 6.3, 6.4; each theme's copy table).
interface AgeingCopy {
  // "Your library now," / "Your library as it'll look in"
  leadNow: string;
  leadAhead: string;
  // How many things have faded, at the previewed date. `total` is the whole library.
  status: (faded: number, total: number, ahead: boolean) => string;
  // The panel's button at month 0 ("Refresh my memory") and while looking ahead.
  refresh: string;
  back: string;
  // The refresh button's title when there is nothing to bring back.
  nothing: string;
  // The button on a faded item.
  dust: string;
  // The card's age text after it was brought back this session. `months` is how long it had gone untouched.
  revived: (months: number, batch: boolean) => string;
  // The toast; `batch` is Refresh my memory rather than one item.
  toast: (count: number, batch: boolean) => string;
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

const NOTHING_TO_BRING_BACK = 'Nothing to bring back yet';

const DEFAULT_AGEING: AgeingCopy = {
  leadNow: 'Your library now,',
  leadAhead: 'Your library as it’ll look in',
  status: (n) => (n === 0 ? 'Nothing has gone yellow yet' : `${plural(n, 'thing')} ${n === 1 ? 'has' : 'have'} gone yellow`),
  refresh: 'Refresh my memory',
  back: 'Back to today',
  nothing: NOTHING_TO_BRING_BACK,
  dust: 'Dust off',
  revived: (months, batch) => (batch && months >= 1 ? `back from ${months} months` : 'dusted off just now'),
  toast: (n, batch) => (batch ? `Brought back ${plural(n, 'thing')} you’d forgotten` : 'Dusted off'),
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
    ageing: DEFAULT_AGEING,
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
    ageing: {
      ...DEFAULT_AGEING,
      status: (n, total, ahead) => {
        if (n === 0) return ahead ? 'By then no frames will have faded' : 'No frames have faded yet';
        const frames = `${n} of ${total} ${total === 1 ? 'frame' : 'frames'}`;
        return ahead ? `By then ${frames} will have faded` : `${frames} ${n === 1 ? 'has' : 'have'} faded`;
      },
      refresh: 'Reprint the three most faded',
      dust: 'Reprint',
      revived: (months, batch) => (batch && months >= 1 ? `back from ${months} mo.` : 'reprinted just now'),
      toast: (n) => `Reprinted ${plural(n, 'frame')}`,
    },
  },
  field: {
    headline: ['Find it by how it ', 'looked'],
    headlineBreak: false,
    filedUnderLead: 'Showing things filed under',
    emptyTitle: 'Nothing here to glow yet',
    noResults: 'Nothing you kept looked like that, yet.',
    itemNoun: ['thing', 'things'],
    index: {
      ...DEFAULT_INDEX,
      staleExplainer: 'They’ve gone grey below. Archived tags leave the index but stay on the things they’re on.',
    },
    ageing: {
      ...DEFAULT_AGEING,
      status: (n, total, ahead) => {
        if (n === 0) return ahead ? 'By then nothing will have lost its colour' : 'Nothing has lost its colour yet';
        const things = `${n} of ${total} ${total === 1 ? 'thing' : 'things'}`;
        const lost = n === 1 ? 'lost its colour' : 'lost their colour';
        return ahead ? `By then ${things} will have ${lost}` : `${things} ${n === 1 ? 'has' : 'have'} ${lost}`;
      },
      refresh: 'Bring back three',
      dust: 'Bring back',
      revived: (months) => (months >= 1 ? `back from ${months} mo.` : 'brought back just now'),
      toast: (n) => `Brought back ${plural(n, 'thing')}`,
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
    ageing: {
      ...DEFAULT_AGEING,
      leadNow: 'The issue on the shelf now,',
      leadAhead: 'Your shelf as it’ll look in',
      status: (n, total, ahead) => {
        if (n === 0) return ahead ? 'By then no covers will be sun-faded' : 'No covers are sun-faded yet';
        const covers = `${n} of ${total} ${total === 1 ? 'cover' : 'covers'}`;
        return ahead ? `By then ${covers} will be sun-faded` : `${covers} ${n === 1 ? 'is' : 'are'} sun-faded`;
      },
      refresh: 'Take three down',
      dust: 'Take down',
      revived: (months) => (months >= 1 ? `back from ${months} mo.` : 'back in print'),
      // The toast itself is headed "Erratum" (covers.css).
      toast: (n) => `${plural(n, 'cover')} taken down`,
    },
  },
};

export function copyFor(theme: Theme): Copy {
  return COPY[theme];
}

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
}

const COPY: Record<Theme, Copy> = {
  default: {
    headline: ['Everything you ', 'kept'],
    headlineBreak: false,
    filedUnderLead: 'Showing things filed under',
    emptyTitle: 'Nothing saved yet',
    noResults: 'Nothing you kept matches that, yet.',
    itemNoun: ['item', 'items'],
  },
  contact: {
    headline: ['Everything you kept,', 'on one sheet'],
    headlineBreak: true,
    filedUnderLead: 'Showing frames filed under',
    emptyTitle: 'Nothing exposed yet',
    noResults: 'No frame on the sheet matches that, yet.',
    itemNoun: ['frame', 'frames'],
  },
};

export function copyFor(theme: Theme): Copy {
  return COPY[theme];
}

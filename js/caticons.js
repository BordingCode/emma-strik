// Garment icons for Emma's custom categories (chosen when creating a category).
// Simple line icons, currentColor. Grouped like the reference app (Toppe/Bukser/Baby/Tilbehør/Hjem).
const S = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

export const CAT_ICONS = {
  sweater:  S('<path d="M8.5 4 4 7l2 3 2.5-1.7"/><path d="M15.5 4 20 7l-2 3-2.5-1.7"/><path d="M8.5 4q3.5 2.4 7 0"/><path d="M8.5 4v16h7V4"/>'),
  cardigan: S('<path d="M8.5 4 4 7l2 3 2.5-1.7"/><path d="M15.5 4 20 7l-2 3-2.5-1.7"/><path d="M9 4 12 6 15 4"/><path d="M8.5 4v16h7V4"/><path d="M12 6v14"/>'),
  tee:      S('<path d="M8.5 5 4.5 7.5 6.5 10 8.5 8.7"/><path d="M15.5 5 19.5 7.5 17.5 10 15.5 8.7"/><path d="M8.5 5q3.5 2.2 7 0"/><path d="M8.5 5v13h7V5"/>'),
  tank:     S('<path d="M9.5 6 10.5 4M14.5 6 13.5 4"/><path d="M9.5 6q2.5 1.4 5 0v13h-5z"/>'),
  vest:     S('<path d="M9 5 12 8 15 5"/><path d="M9 5 6 7v12h12V7l-3-2"/><path d="M12 8v3"/>'),
  pants:    S('<path d="M8 4h8l-1 16h-2.6L12 11l-.4 9H9z"/>'),
  shorts:   S('<path d="M7.5 5h9l-.8 8h-3L12 9l-.7 4h-3z"/>'),
  skirt:    S('<path d="M8 5h8l3 14H5z"/><path d="M8 5q4 2 8 0"/>'),
  socks:    S('<path d="M13 3h-3v9l-4 4q-1.2 1.2 0 2.4L8.5 20l2.5-3 3-4.5V3z"/>'),
  mittens:  S('<path d="M8 9q0-4 3.5-4T15 9v8H8z"/><path d="M8 11q-3 0-3 2.2T8 15"/>'),
  beanie:   S('<path d="M5 14q0-8 7-8t7 8z"/><path d="M4 14h16v2.5H4z"/>'),
  scarf:    S('<path d="M8 5q4 3 8 0v4q-4 3-8 0z"/><path d="M9 9v10M15 9v10"/>'),
  shawl:    S('<path d="M4 6h16L12 20z"/>'),
  blanket:  S('<rect x="4.5" y="6" width="15" height="13" rx="1.5"/><path d="M4.5 10h15M4.5 14h15"/>'),
  baby:     S('<path d="M9 4 5 7l2 3 2-1.4V16H8v4h8v-4h-1V8.6l2 1.4 2-3-4-3q-3 2-6 0z"/>'),
  bag:      S('<path d="M6.5 9h11l-1 11h-9z"/><path d="M9.5 9q0-4 2.5-4t2.5 4"/>'),
  yarn:     S('<circle cx="12" cy="12" r="8"/><path d="M5.5 9.5q6.5 3 13 0M4.5 13q7.5 4 15 0M9.5 4.5q-3 6.5 0 15M14.5 4.5q3 6.5 0 15" stroke-width="1.1"/>'),
};

// Grouped for the picker UI.
export const ICON_GROUPS = [
  { label: 'Toppe', ids: ['sweater', 'cardigan', 'tee', 'tank', 'vest'] },
  { label: 'Bukser & nederdele', ids: ['pants', 'shorts', 'skirt'] },
  { label: 'Tilbehør', ids: ['beanie', 'scarf', 'shawl', 'mittens', 'socks', 'bag'] },
  { label: 'Baby', ids: ['baby'] },
  { label: 'Hjem', ids: ['blanket', 'yarn'] },
];
export const DEFAULT_ICON = 'yarn';

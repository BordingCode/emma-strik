// Themes — sets data-theme on <html>; CSS variables do the rest. Stored per-device.
import { store } from './store.js';

// dots = [background, primary, accent] shown as little swatches in the picker.
export const THEMES = [
  { id: '', name: 'Uld', themeColor: '#b0654a', dots: ['#e4d7bf', '#b0654a', '#5f7a57'] },
  { id: 'lavendel', name: 'Lavendel', themeColor: '#8a6aa6', dots: ['#ddd2e6', '#8a6aa6', '#c79a4f'] },
  { id: 'havbla', name: 'Havblå', themeColor: '#3f7193', dots: ['#cfdde4', '#3f7193', '#4f8079'] },
  { id: 'skovgron', name: 'Skovgrøn', themeColor: '#5f7a4d', dots: ['#d6e0c6', '#5f7a4d', '#8a7d3f'] },
  { id: 'rosenkvarts', name: 'Rosenkvarts', themeColor: '#bd6a73', dots: ['#eed3d2', '#bd6a73', '#6f8a6a'] },
  { id: 'aften', name: 'Aften', themeColor: '#352c24', dots: ['#1c1916', '#c8825f', '#7f9a76'] },
];

export const currentTheme = () => store.get('theme', '');

export function applyTheme(id, persist = true) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  const r = document.documentElement;
  if (t.id) r.dataset.theme = t.id; else delete r.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t.themeColor;
  if (persist) store.set('theme', t.id);
}

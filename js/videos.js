// Help-video library (localStorage). Each video may be attached to a recipe (patternId)
// and/or a category (categoryId = a collection id), so the right videos show in context.
import { store, uid } from './store.js';

const DEFAULTS = [
  { title: 'Kimmie Munkholm (dansk)', url: 'https://www.youtube.com/channel/UC3vgNeiHiliP8q9fVwjnA5w' },
  { title: 'PetiteKnit · teknik-videoer', url: 'https://www.petiteknit.com/en/pages/video' },
  { title: 'Søg på YouTube (strikketeknik)', url: 'https://www.youtube.com/results?search_query=strikketeknik+dansk' },
];

// Seeded once. After that the stored array is authoritative (so deletes stick).
export function getVideos() {
  let v = store.get('videos', null);
  if (v == null) { v = DEFAULTS.map((d) => ({ id: uid(), title: d.title, url: d.url, patternId: null, categoryId: null })); store.set('videos', v); }
  return v;
}
export function saveVideos(v) { store.set('videos', v); }

// Videos attached to a given recipe id OR to any of the given category (collection) ids.
export function videosForPattern(patternId, categoryIds) {
  const cats = new Set(categoryIds || []);
  return getVideos().filter((v) => (v.patternId && v.patternId === patternId) || (v.categoryId && cats.has(v.categoryId)));
}

// Collection ids that contain a given pattern card id.
export function categoryIdsForPattern(patternId) {
  return store.get('collections', []).filter((c) => (c.items || []).includes(patternId)).map((c) => c.id);
}

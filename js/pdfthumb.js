// Render the first page of a PDF to a small JPEG data URL (used as a gallery thumbnail).
export async function pdfThumb(blob, width = 280) {
  const pdfjsLib = await import('../vendor/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
  const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const s = width / page.getViewport({ scale: 1 }).width;
  const vp = page.getViewport({ scale: s });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c.toDataURL('image/jpeg', 0.7);
}

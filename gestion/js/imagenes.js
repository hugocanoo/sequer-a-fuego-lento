// Comprime en el propio móvil antes de subir: dos tamaños WebP (1600 y 800 px de ancho).
// Así una foto de 6 MB del carrete se queda en ~250 KB y la web carga rápido sin plan de pago.
export const ANCHOS = [1600, 800];

export async function prepararFoto(archivo) {
  if (!/^image\//.test(archivo.type) && !/\.(heic|heif)$/i.test(archivo.name)) {
    throw new Error(`«${archivo.name}» no es una foto.`);
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch (_) {
    throw new Error(`No puedo abrir «${archivo.name}». Si es HEIC, en el iPhone ve a Ajustes › Cámara › Formatos › «Más compatible».`);
  }
  const blobs = {};
  for (const ancho of ANCHOS) {
    const escala = Math.min(1, ancho / bitmap.width);
    const w = Math.round(bitmap.width * escala), h = Math.round(bitmap.height * escala);
    const lienzo = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    blobs[ancho] = lienzo.convertToBlob
      ? await lienzo.convertToBlob({ type: 'image/webp', quality: 0.8 })
      : await new Promise((ok) => lienzo.toBlob(ok, 'image/webp', 0.8));
  }
  const vertical = bitmap.height > bitmap.width;
  bitmap.close && bitmap.close();
  return { blobs, vertical };
}

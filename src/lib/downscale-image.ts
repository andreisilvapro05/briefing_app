/**
 * Reduz uma imagem no NAVEGADOR antes do upload (canvas → JPEG). Foto de
 * celular tem 2–8MB; Server Action do Next aceita 1MB por padrão (e a
 * Vercel corta em ~4,5MB) — sem isso o upload de avatar estourava com
 * "A server error occurred". Avatar não precisa de mais que ~640px.
 *
 * Qualquer falha (formato exótico, canvas indisponível) devolve o arquivo
 * original — o servidor ainda valida tipo e tamanho.
 */
export async function downscaleImage(
  file: File,
  maxDim = 640,
  quality = 0.85
): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      return file;
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    // Se por algum motivo o resultado ficou maior que o original, mantém o original.
    if (blob.size >= file.size && file.size <= 900 * 1024) return file;

    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

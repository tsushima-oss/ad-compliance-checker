// Images are stored as base64 in the database.
// storagePut is a no-op stub; images are served via /api/image/:id.
// exportPdf returns base64 directly without uploading.

export async function storagePut(
  relKey: string,
  _data: Buffer | Uint8Array | string,
  _contentType?: string,
): Promise<{ key: string; url: string }> {
  return { key: relKey, url: `/api/image/${relKey}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  return { key: relKey, url: `/api/image/${relKey}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return `/api/image/${relKey}`;
}

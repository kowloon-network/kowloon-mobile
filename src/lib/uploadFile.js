// Upload a local file (from expo-image-picker, expo-document-picker, etc.)
// through @kowloon/client's files.upload. Type-agnostic — handles images,
// audio, video, or anything else the server's file pipeline accepts.
//
// The client library's upload constructs FormData. For React Native, the
// `file` field is most reliably appended as `{ uri, name, type }` rather
// than a Blob or Buffer; RN's fetch knows how to send that shape.
//
// Returns the server's upload response: { ok, file: { id, url, thumbnails, metadata } }.

import { normalizeImageForUpload } from "./normalizeImage.js";

export async function uploadFile(
  client,
  {
    uri,
    name,
    mimeType,
    title,
    summary,
    to,
    parentObject,
    generateThumbnail,
    thumbnailSizes,
    onProgress,
  }
) {
  if (!client) throw new Error("uploadFile: no client");
  if (!uri) throw new Error("uploadFile: uri is required");

  // Bake EXIF orientation upright (and cap size) for JPEG/HEIC before sending.
  // No-op for GIFs/PNGs/video/audio. This is the fix for sideways uploads --
  // the orientation tag is gone by the time the server sees the bytes, so it
  // has to happen here, on the device, while the pixels can still be corrected.
  ({ uri, name, mimeType } = await normalizeImageForUpload({ uri, name, mimeType }));

  const filename = name || `upload-${Date.now()}`;
  const contentType = mimeType || "application/octet-stream";

  // RN FormData accepts this shape directly. The client library falls
  // through to `formData.append('file', file, filename)` for non-Blob /
  // non-Buffer inputs, so RN's native handling kicks in.
  const filePart = { uri, name: filename, type: contentType };

  return await client.files.upload({
    file: filePart,
    filename,
    contentType,
    title,
    summary,
    to,
    parentObject,
    generateThumbnail,
    thumbnailSizes,
    onProgress,
  });
}

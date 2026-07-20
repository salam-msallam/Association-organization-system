import { diskStorage } from 'multer';
import { extname } from 'path';

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function extensionFromOriginalName(originalName: string): string | null {
  const extension = extname(originalName).toLowerCase();

  if (/^\.[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  return null;
}

export function resolveUploadExtension(file: Express.Multer.File): string {
  return (
    MIME_TYPE_EXTENSIONS[file.mimetype] ??
    extensionFromOriginalName(file.originalname) ??
    '.bin'
  );
}

export function createUploadStorage(destination: string) {
  return diskStorage({
    destination,
    filename: (req, file, callback) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${uniqueSuffix}${resolveUploadExtension(file)}`);
    },
  });
}

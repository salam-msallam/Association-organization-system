import * as fs from 'fs';
import * as path from 'path';

export const TEST_FAMILY_STATEMENT_PATH =
  'uploads/beneficiaries/test-family-statement.pdf';
export const TEST_PERSONAL_PHOTO_PATH =
  'uploads/beneficiaries/test-personal-photo.png';
export const TEST_REQUEST_MEDIA_PATH =
  'uploads/request-media/test-request-media.png';
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

export function ensureSeedMediaFiles() {
  const beneficiaryUploadsDir = path.join(
    process.cwd(),
    'uploads',
    'beneficiaries',
  );
  const requestMediaUploadsDir = path.join(
    process.cwd(),
    'uploads',
    'request-media',
  );

  fs.mkdirSync(beneficiaryUploadsDir, { recursive: true });
  fs.mkdirSync(requestMediaUploadsDir, { recursive: true });

  writeFileWhenMissing(
    path.join(process.cwd(), TEST_FAMILY_STATEMENT_PATH),
    Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
      'utf8',
    ),
  );
  writeFileWhenMissing(
    path.join(process.cwd(), TEST_PERSONAL_PHOTO_PATH),
    Buffer.from(TEST_IMAGE_BASE64, 'base64'),
  );
  writeFileWhenMissing(
    path.join(process.cwd(), TEST_REQUEST_MEDIA_PATH),
    Buffer.from(TEST_IMAGE_BASE64, 'base64'),
  );
}

function writeFileWhenMissing(filePath: string, content: Buffer) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
  }
}

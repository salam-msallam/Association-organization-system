import { toPublicUploadPath, toPublicUploadUrl } from './upload-storage.util';

describe('toPublicUploadPath', () => {
  it('converts a Windows upload path to a browser-compatible path', () => {
    expect(
      toPublicUploadPath('uploads\\beneficiaries\\personal-photo.png'),
    ).toBe('uploads/beneficiaries/personal-photo.png');
  });

  it('keeps an existing browser-compatible path unchanged', () => {
    expect(
      toPublicUploadPath('./uploads/beneficiaries/personal-photo.png'),
    ).toBe('uploads/beneficiaries/personal-photo.png');
  });

  it('builds an absolute browser URL from the current request origin', () => {
    expect(
      toPublicUploadUrl(
        'uploads\\beneficiaries\\personal-photo.png',
        'http://localhost:3000',
      ),
    ).toBe('http://localhost:3000/uploads/beneficiaries/personal-photo.png');
  });

  it('does not prefix an already absolute URL', () => {
    expect(
      toPublicUploadUrl(
        'https://cdn.example.com/personal-photo.png',
        'http://localhost:3000',
      ),
    ).toBe('https://cdn.example.com/personal-photo.png');
  });
});

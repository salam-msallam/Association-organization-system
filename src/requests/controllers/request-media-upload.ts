import { BadRequestException } from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';

const REQUEST_MEDIA_DESTINATION = './uploads/request-media';

function adminUploadTypeError(
  req: Request,
  isDonorImage: boolean,
): string {
  const requestedLanguage = String(req.headers['accept-language'] ?? 'ar');
  const isEnglish = requestedLanguage.toLowerCase().startsWith('en');

  if (isDonorImage) {
    return isEnglish
      ? 'donorImage must be a JPG, JPEG, PNG, or WEBP image.'
      : 'يجب أن تكون donorImage صورة بصيغة JPG أو JPEG أو PNG أو WEBP.';
  }

  return isEnglish
    ? 'media files must be JPG, JPEG, PNG, WEBP, or PDF.'
    : 'يجب أن تكون ملفات media بصيغة JPG أو JPEG أو PNG أو WEBP أو PDF.';
}

const requestMediaStorage = diskStorage({
  destination: REQUEST_MEDIA_DESTINATION,
  filename: (req, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

export function RequestMediaUploadInterceptor() {
  return FilesInterceptor('media', 10, {
    storage: requestMediaStorage,
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
        return callback(
          new BadRequestException('Only image or PDF files are allowed'),
          false,
        );
      }

      callback(null, true);
    },
  });
}

export function DonorImageUploadInterceptor() {
  return FileInterceptor('media', {
    storage: requestMediaStorage,
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return callback(
          new BadRequestException('Only image files are allowed'),
          false,
        );
      }

      callback(null, true);
    },
  });
}

export function AdminRequestMediaUploadInterceptor() {
  return FileFieldsInterceptor(
    [
      { name: 'media', maxCount: 10 },
      { name: 'donorImage', maxCount: 1 },
    ],
    {
      storage: requestMediaStorage,
      fileFilter: (req, file, callback) => {
        const isDonorImage = file.fieldname === 'donorImage';
        const allowedMimeType = isDonorImage
          ? /\/(jpg|jpeg|png|webp)$/
          : /\/(jpg|jpeg|png|webp|pdf)$/;

        if (!file.mimetype.match(allowedMimeType)) {
          return callback(
            new BadRequestException(
              adminUploadTypeError(req, isDonorImage),
            ),
            false,
          );
        }

        callback(null, true);
      },
    },
  );
}

export function toMediaUrls(files?: Express.Multer.File[]): string[] | undefined {
  if (!files?.length) return undefined;

  return files.map((file) => file.path);
}

export function toMediaUrl(file?: Express.Multer.File): string | undefined {
  return file?.path;
}

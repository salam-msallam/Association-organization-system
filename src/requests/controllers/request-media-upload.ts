import { BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

const REQUEST_MEDIA_DESTINATION = './uploads/request-media';

export function RequestMediaUploadInterceptor() {
  return FilesInterceptor('media', 10, {
    storage: diskStorage({
      destination: REQUEST_MEDIA_DESTINATION,
      filename: (req, file, callback) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
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

export function toMediaUrls(files?: Express.Multer.File[]): string[] | undefined {
  if (!files?.length) return undefined;

  return files.map(
    (file) => `http://localhost:3000/uploads/request-media/${file.filename}`,
  );
}

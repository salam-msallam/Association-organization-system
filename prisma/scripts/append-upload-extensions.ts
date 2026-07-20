import { PrismaClient } from '@prisma/client';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
} from 'fs';
import { basename, extname, isAbsolute, join, relative, sep } from 'path';

const prisma = new PrismaClient();
const uploadsDirectories = [
  join(process.cwd(), 'uploads', 'beneficiaries'),
  join(process.cwd(), 'uploads', 'orphans'),
];

function inferExtension(filePath: string): string | null {
  const bytes = readFileSync(filePath);

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return '.jpg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return '.png';
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }

  if (bytes.length >= 4 && bytes.toString('ascii', 0, 4) === '%PDF') {
    return '.pdf';
  }

  return null;
}

function dbPathCandidates(filePath: string): string[] {
  const relativePath = relative(process.cwd(), filePath);
  const forwardPath = relativePath.split(sep).join('/');
  const nativePath = relativePath.split('/').join(sep);

  return Array.from(new Set([relativePath, forwardPath, nativePath, filePath]));
}

function withSamePathStyle(oldPath: string, newFilePath: string): string {
  if (isAbsolute(oldPath)) {
    return newFilePath;
  }

  const relativePath = relative(process.cwd(), newFilePath);

  if (oldPath.includes('/')) {
    return relativePath.split(sep).join('/');
  }

  return relativePath.split('/').join(sep);
}

async function updateStoredPaths(oldFilePath: string, newFilePath: string) {
  let updatedRows = 0;

  for (const oldPath of dbPathCandidates(oldFilePath)) {
    const newPath = withSamePathStyle(oldPath, newFilePath);

    const personalPhoto = await prisma.beneficiary.updateMany({
      where: { personalPhoto: oldPath },
      data: { personalPhoto: newPath },
    });
    const familyStatement = await prisma.beneficiary.updateMany({
      where: { familyStatement: oldPath },
      data: { familyStatement: newPath },
    });
    const orphanFamilyStatement = await prisma.orphan.updateMany({
      where: { FamilyStatement: oldPath },
      data: { FamilyStatement: newPath },
    });

    updatedRows +=
      personalPhoto.count + familyStatement.count + orphanFamilyStatement.count;
  }

  return updatedRows;
}

async function main() {
  let renamedFiles = 0;
  let updatedRows = 0;
  const unknownFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const directory of uploadsDirectories) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    for (const entry of readdirSync(directory)) {
      if (entry.startsWith('.')) {
        continue;
      }

      const filePath = join(directory, entry);

      if (!statSync(filePath).isFile() || extname(filePath)) {
        continue;
      }

      const extension = inferExtension(filePath);

      if (!extension) {
        unknownFiles.push(filePath);
        continue;
      }

      const newFilePath = `${filePath}${extension}`;

      if (existsSync(newFilePath)) {
        skippedFiles.push(filePath);
        continue;
      }

      renameSync(filePath, newFilePath);
      renamedFiles++;
      updatedRows += await updateStoredPaths(filePath, newFilePath);
      console.log(`Renamed ${basename(filePath)} -> ${basename(newFilePath)}`);
    }
  }

  console.log(
    `Completed upload extension cleanup. Renamed files: ${renamedFiles}. Updated DB rows: ${updatedRows}.`,
  );

  if (unknownFiles.length) {
    console.log('Unknown extensionless files left unchanged:');
    unknownFiles.forEach((filePath) => console.log(`- ${filePath}`));
  }

  if (skippedFiles.length) {
    console.log('Files skipped because the target filename already exists:');
    skippedFiles.forEach((filePath) => console.log(`- ${filePath}`));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

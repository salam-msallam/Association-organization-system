import { SetMetadata } from '@nestjs/common';

export const PRESERVE_BILINGUAL_RESPONSE = 'preserveBilingualResponse';

export const PreserveBilingualResponse = () =>
  SetMetadata(PRESERVE_BILINGUAL_RESPONSE, true);

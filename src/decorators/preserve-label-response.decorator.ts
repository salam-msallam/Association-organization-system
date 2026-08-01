import { SetMetadata } from '@nestjs/common';

export const PRESERVE_LABEL_RESPONSE = 'preserveLabelResponse';

export const PreserveLabelResponse = () =>
  SetMetadata(PRESERVE_LABEL_RESPONSE, true);

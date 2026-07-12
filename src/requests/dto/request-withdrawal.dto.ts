import { IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

export class RequestWithdrawalDto {
  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'سبب طلب الانسحاب (اختياري)',
    example: { ar: 'لم أعد بحاجة للمساعدة', en: 'No longer need assistance' },
  })
  @IsOptional()
  @ParseBilingualText()
  reason?: BilingualTextDto;
}
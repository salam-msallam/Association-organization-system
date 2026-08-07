import { Controller, Get } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DonorService } from './donor.service';
import { CompletedAidCasesCountResponseDto } from './dto/public-statistics-response.dto';

@ApiTags('Public Statistics')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for response messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('public/statistics')
export class PublicStatisticsController {
  constructor(private readonly donorService: DonorService) {}

  @Get('completed-aid-cases')
  @ApiOperation({
    summary: 'Get the number of completed aid cases for public mobile clients',
  })
  @ApiOkResponse({
    type: CompletedAidCasesCountResponseDto,
    description: 'Completed aid cases count',
  })
  getCompletedAidCasesCount(): Promise<CompletedAidCasesCountResponseDto> {
    return this.donorService.getCompletedAidCasesCount();
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RequestAidService } from '../requests.service';
import { RequestWithdrawalDto } from '../dto/request-withdrawal.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

@ApiTags('Requests')
@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Get('my-requests')
  @ApiBearerAuth('jwt')
  getMyRequests(@Req() req: AuthenticatedRequest) {
    return this.requestAidService.getMyRequests(req.user.id);
  }

  @Delete('cancel/:id')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'إلغاء طلب الإعانة من قبل المستفيد (بس لو PENDING)' })
  cancelRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requestAidService.cancelRequestAid(req.user.id, id);
  }

  @Patch('withdraw/:id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'تقديم طلب انسحاب من طلب تمت مراجعته (ACCEPTED)',
  })
  requestWithdrawal(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.requestAidService.requestWithdrawal(
      req.user.id,
      id,
      dto.reason,
    );
  }
}
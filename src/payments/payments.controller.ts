import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { RawBodyRequest } from '@nestjs/common/interfaces';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAidRequestPaymentIntentDto } from './dto/create-aid-request-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { PaymentsService } from './payments.service';

interface AuthenticatedPaymentRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Payments')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for translated payment messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('aid-requests/:requestId/payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a Stripe PaymentIntent for a direct aid request donation',
  })
  @ApiParam({ name: 'requestId', type: Number, example: 13 })
  @ApiBody({ type: CreateAidRequestPaymentIntentDto })
  @ApiOkResponse({ type: PaymentIntentResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid amount, invalid request ID, or amount exceeds remaining need.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  createAidRequestPaymentIntent(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: CreateAidRequestPaymentIntentDto,
    @Req() req: AuthenticatedPaymentRequest,
    @I18nLang() lang: string,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.createAidRequestPaymentIntent(
      requestId,
      dto,
      req.user,
      lang,
    );
  }

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public Stripe webhook endpoint with raw-body signature verification',
  })
  @ApiOkResponse({ description: 'Webhook event accepted.' })
  @ApiBadRequestResponse({ description: 'Invalid Stripe signature or payload.' })
  handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string | string[],
    @I18nLang() lang = 'ar',
  ): Promise<{ received: true }> {
    return this.paymentsService.handleStripeWebhook(
      req.rawBody,
      signature,
      lang,
    );
  }
}

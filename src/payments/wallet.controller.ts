import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWalletTopUpPaymentIntentDto } from './dto/create-wallet-top-up-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { PaymentsService } from './payments.service';

interface AuthenticatedWalletRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Wallet')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for translated payment messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('wallet')
export class WalletController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('top-up/payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a Stripe PaymentIntent for topping up the donor wallet',
  })
  @ApiBody({ type: CreateWalletTopUpPaymentIntentDto })
  @ApiOkResponse({ type: PaymentIntentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid top-up amount.' })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  createWalletTopUpPaymentIntent(
    @Body() dto: CreateWalletTopUpPaymentIntentDto,
    @Req() req: AuthenticatedWalletRequest,
    @I18nLang() lang: string,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.createWalletTopUpPaymentIntent(
      dto,
      req.user,
      lang,
    );
  }
}

import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateQuickAidFundPaymentIntentDto } from './dto/create-quick-aid-fund-payment-intent.dto';
import { DonateWalletToQuickAidFundDto } from './dto/donate-wallet-to-quick-aid-fund.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { WalletQuickAidFundDonationResponseDto } from './dto/wallet-quick-aid-fund-donation-response.dto';
import { PaymentsService } from './payments.service';

interface AuthenticatedQuickAidFundRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Quick Aid Fund')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for translated payment messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/donor/quick-aid-fund')
export class QuickAidFundController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a Stripe PaymentIntent for the quick aid fund',
  })
  @ApiBody({ type: CreateQuickAidFundPaymentIntentDto })
  @ApiOkResponse({ type: PaymentIntentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid donation amount.' })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated user is not a donor.' })
  createPaymentIntent(
    @Body() dto: CreateQuickAidFundPaymentIntentDto,
    @Req() req: AuthenticatedQuickAidFundRequest,
    @I18nLang() lang: string,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.createQuickAidFundPaymentIntent(
      dto,
      req.user,
      lang,
    );
  }

  @Post('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Donate to the quick aid fund from wallet balance' })
  @ApiBody({ type: DonateWalletToQuickAidFundDto })
  @ApiOkResponse({ type: WalletQuickAidFundDonationResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid amount, insufficient balance, or concurrent update.',
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not a donor or is a sponsor.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiNotFoundResponse({ description: 'Donor wallet was not found.' })
  donateFromWallet(
    @Body() dto: DonateWalletToQuickAidFundDto,
    @Req() req: AuthenticatedQuickAidFundRequest,
    @I18nLang() lang: string,
  ): Promise<WalletQuickAidFundDonationResponseDto> {
    return this.paymentsService.donateWalletToQuickAidFund(
      dto,
      req.user,
      lang,
    );
  }
}

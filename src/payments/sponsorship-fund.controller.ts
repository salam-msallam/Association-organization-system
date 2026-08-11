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
import { CreateSponsorshipFundPaymentIntentDto } from './dto/create-sponsorship-fund-payment-intent.dto';
import { DonateWalletToSponsorshipFundDto } from './dto/donate-wallet-to-sponsorship-fund.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { WalletSponsorshipFundDonationResponseDto } from './dto/wallet-sponsorship-fund-donation-response.dto';
import { PaymentsService } from './payments.service';

interface AuthenticatedSponsorshipFundRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Sponsorship Fund')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for translated payment messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/donor/sponsorship-fund')
export class SponsorshipFundController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Create a Stripe PaymentIntent for the sponsorship continuity fund',
  })
  @ApiBody({ type: CreateSponsorshipFundPaymentIntentDto })
  @ApiOkResponse({ type: PaymentIntentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid donation amount.' })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated user is not a donor.' })
  createPaymentIntent(
    @Body() dto: CreateSponsorshipFundPaymentIntentDto,
    @Req() req: AuthenticatedSponsorshipFundRequest,
    @I18nLang() lang: string,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.createSponsorshipFundPaymentIntent(
      dto,
      req.user,
      lang,
    );
  }

  @Post('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Donate to the sponsorship continuity fund from wallet balance',
  })
  @ApiBody({ type: DonateWalletToSponsorshipFundDto })
  @ApiOkResponse({ type: WalletSponsorshipFundDonationResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid amount, insufficient balance, or concurrent update.',
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not a donor or is a sponsor.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiNotFoundResponse({ description: 'Donor wallet was not found.' })
  donateFromWallet(
    @Body() dto: DonateWalletToSponsorshipFundDto,
    @Req() req: AuthenticatedSponsorshipFundRequest,
    @I18nLang() lang: string,
  ): Promise<WalletSponsorshipFundDonationResponseDto> {
    return this.paymentsService.donateWalletToSponsorshipFund(
      dto,
      req.user,
      lang,
    );
  }
}

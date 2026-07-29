import {
  Body,
  Controller,
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
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWalletTopUpPaymentIntentDto } from './dto/create-wallet-top-up-payment-intent.dto';
import { DonateWalletToAidRequestDto } from './dto/donate-wallet-to-aid-request.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { WalletAidRequestDonationResponseDto } from './dto/wallet-aid-request-donation-response.dto';
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

  @Post('donate/aid-requests/:requestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Donate to an accepted aid request from the donor wallet balance',
  })
  @ApiParam({ name: 'requestId', type: Number, example: 13 })
  @ApiBody({ type: DonateWalletToAidRequestDto })
  @ApiOkResponse({ type: WalletAidRequestDonationResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid amount, insufficient balance, amount exceeds remaining need, or a concurrent update changed the request.',
  })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a donor or wallet balance is reserved for sponsorship.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiNotFoundResponse({
    description: 'Accepted aid request or donor wallet was not found.',
  })
  donateWalletToAidRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: DonateWalletToAidRequestDto,
    @Req() req: AuthenticatedWalletRequest,
    @I18nLang() lang: string,
  ): Promise<WalletAidRequestDonationResponseDto> {
    return this.paymentsService.donateWalletToAidRequest(
      requestId,
      dto,
      req.user,
      lang,
    );
  }
}

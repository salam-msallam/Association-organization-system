import { ApiProperty } from '@nestjs/swagger';

class WalletBalanceDataDto {
  @ApiProperty({ example: '250.00' })
  balance!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

export class WalletBalanceResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: WalletBalanceDataDto })
  data!: WalletBalanceDataDto;
}

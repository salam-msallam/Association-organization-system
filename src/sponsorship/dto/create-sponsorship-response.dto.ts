import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';

class SponsorshipRequestDataDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 7 })
  donorId!: number;

  @ApiProperty({ example: '10.00' })
  monthlyAmount!: string;

  @ApiProperty({ enum: Status, example: Status.PENDING })
  status!: Status;

  @ApiProperty({ example: null, nullable: true })
  orphanId!: number | null;

  @ApiProperty({ example: null, nullable: true })
  employeeId!: number | null;

  @ApiProperty({ example: '60.00' })
  requiredWalletBalance!: string;

  @ApiProperty({ example: '75.00' })
  walletBalance!: string;

  @ApiProperty({ example: '2026-07-28T12:00:00.000Z' })
  createdAt!: Date;
}

export class CreateSponsorshipResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'Your sponsorship request is pending employee review.',
  })
  message!: string;

  @ApiProperty({ type: SponsorshipRequestDataDto })
  data!: SponsorshipRequestDataDto;
}

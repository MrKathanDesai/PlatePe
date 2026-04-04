import { IsUUID, IsNumber, IsIn, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsIn(['CASH', 'DIGITAL', 'UPI'])
  method: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  upiRef?: string;
}

export class RefundPaymentDto {
  @IsString()
  reason: string;
}

export class SplitBillDto {
  @IsIn(['EVEN', 'BY_ITEM'])
  mode: 'EVEN' | 'BY_ITEM';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  partySize?: number;

  @IsOptional()
  splits?: { guestIndex: number; itemIds: string[] }[];
}

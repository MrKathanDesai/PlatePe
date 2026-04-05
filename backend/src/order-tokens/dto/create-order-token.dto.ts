import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { OrderTokenStatus } from '../entities/order-token.entity';

export class CreateOrderTokenDto {
  @IsUUID()
  orderId: string;
}

export class UpdateOrderTokenStatusDto {
  @IsOptional()
  @IsIn(['ISSUED', 'IN_PREP', 'READY', 'COMPLETED', 'EXPIRED'])
  status?: OrderTokenStatus;
}

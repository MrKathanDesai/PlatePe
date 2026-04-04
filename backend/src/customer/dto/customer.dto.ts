import { IsString, IsOptional, IsUUID, IsNumber, Min, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SendOtpDto {
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class VerifyFirebaseTokenDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateCustomerOrderDto {
  @IsUUID()
  tableId: string;
}

class CustomerOrderItemDto {
  @IsUUID()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  modifiers?: { id: string; name: string; price: number }[];

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddCustomerItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerOrderItemDto)
  items: CustomerOrderItemDto[];
}

export class CreateCustomerPaymentDto {
  @IsUUID()
  orderId: string;

  @IsIn(['CASH', 'DIGITAL', 'UPI'])
  method: 'CASH' | 'DIGITAL' | 'UPI';

  @IsOptional()
  @IsString()
  upiRef?: string;
}

import { IsString, IsOptional, IsUUID, IsNumber, Min, IsArray, ValidateNested } from 'class-validator';
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

export class CreateRazorpayOrderDto {
  @IsUUID()
  orderId: string;
}

export class VerifyRazorpayPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;

  @IsUUID()
  orderId: string;
}

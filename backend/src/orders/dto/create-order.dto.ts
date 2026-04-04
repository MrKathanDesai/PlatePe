import {
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class ModifierDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsNumber() price: number;
}

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsString()
  productName: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierDto)
  modifiers?: ModifierDto[];

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsIn(['POS', 'SELF', 'TOKEN'])
  source?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}

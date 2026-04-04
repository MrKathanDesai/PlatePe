import { IsNumber, Min, Max, IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyDiscountDto {
  @IsIn(['PERCENTAGE', 'FIXED'])
  type: 'PERCENTAGE' | 'FIXED';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

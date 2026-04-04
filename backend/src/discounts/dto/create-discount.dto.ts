import { IsString, IsNumber, IsIn, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDiscountDto {
  @IsString()
  name: string;

  @IsIn(['PERCENTAGE', 'FIXED'])
  type: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvalThreshold?: number;
}

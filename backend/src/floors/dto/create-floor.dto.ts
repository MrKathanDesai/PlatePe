import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFloorDto {
  @IsString()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(400)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(300)
  height?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

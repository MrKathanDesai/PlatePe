import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  seats?: number;

  @IsOptional()
  @IsString()
  floorId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  x?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  y?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  width?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  height?: number | null;

  @IsOptional()
  @IsString()
  shape?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rotation?: number;
}

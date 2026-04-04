import { IsString, IsOptional } from 'class-validator';

export class VoidItemDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

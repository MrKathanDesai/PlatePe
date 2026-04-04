import { IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenSessionDto {
  @IsUUID()
  terminalId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance: number;
}

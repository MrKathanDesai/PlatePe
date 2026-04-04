import { IsString, IsOptional } from 'class-validator';

export class CreateTerminalDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  location?: string;
}

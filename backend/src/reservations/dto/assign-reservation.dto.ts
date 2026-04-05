import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AssignReservationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  tableIds: string[];

  @IsOptional()
  @IsUUID('4')
  primaryTableId?: string;
}

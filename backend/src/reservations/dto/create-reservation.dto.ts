import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { ReservationChannel, ReservationStatus } from '../entities/reservation.entity';

export class CreateReservationDto {
  @IsString()
  guestName: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  partySize: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED'])
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsIn(['PHONE', 'WALK_IN', 'ONLINE'])
  channel?: ReservationChannel;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tableIds?: string[];

  @IsOptional()
  @IsUUID('4')
  primaryTableId?: string;
}

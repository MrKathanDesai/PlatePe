import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Floor } from '../../floors/entities/floor.entity';

export type TableStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Needs Attention'
  | 'Unpaid';

export type TableAttentionType = 'PAYMENT_CASH' | 'PAYMENT_CARD';

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  number: string;

  @Column({ default: 4 })
  seats: number;

  @ManyToOne(() => Floor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'floorId' })
  floor: Floor | null;

  @Column({ type: 'uuid', nullable: true })
  floorId: string | null;

  @Column({ type: 'int', nullable: true })
  x: number | null;

  @Column({ type: 'int', nullable: true })
  y: number | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'varchar', nullable: true })
  shape: string | null;

  @Column({ type: 'int', default: 0 })
  rotation: number;

  @Column({ type: 'varchar', default: 'Available' })
  status: TableStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentBill: number | null;

  @Column({ type: 'varchar', nullable: true })
  attentionType: TableAttentionType | null;

  @Column({ type: 'timestamp', nullable: true })
  attentionRequestedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  occupiedSince: Date | null;

  @Column({ type: 'varchar', nullable: true })
  currentOrderId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

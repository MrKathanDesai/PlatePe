import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TableStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Needs Attention'
  | 'Unpaid';

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  number: string;

  @Column({ default: 4 })
  seats: number;

  @Column({ type: 'varchar', nullable: true })
  floorId: string | null;

  @Column({ type: 'varchar', default: 'Available' })
  status: TableStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentBill: number | null;

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

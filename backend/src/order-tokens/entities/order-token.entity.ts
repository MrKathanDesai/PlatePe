import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export type OrderTokenStatus =
  | 'ISSUED'
  | 'IN_PREP'
  | 'READY'
  | 'COMPLETED'
  | 'EXPIRED';

@Entity('order_tokens')
export class OrderToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'int' })
  displayNumber: number;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  publicCode: string;

  @Column({ type: 'varchar', default: 'ISSUED' })
  status: OrderTokenStatus;

  @CreateDateColumn()
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readyAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

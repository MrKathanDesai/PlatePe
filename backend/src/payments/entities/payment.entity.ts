import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export type PaymentMethod = 'CASH' | 'DIGITAL' | 'UPI';
export type PaymentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REFUNDED';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @Column({ type: 'varchar' })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: PaymentStatus;

  @Column({ nullable: true })
  upiRef: string;

  @Column({ nullable: true })
  confirmedBy: string;

  @Column({ nullable: true })
  refundReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

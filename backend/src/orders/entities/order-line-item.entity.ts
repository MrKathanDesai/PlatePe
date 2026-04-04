import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

export type LineItemStatus = 'Pending' | 'Sent' | 'Done' | 'Voided';

@Entity('order_line_items')
export class OrderLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'jsonb', default: '[]' })
  modifiers: { id: string; name: string; price: number }[];

  @Column({ nullable: true })
  note: string;

  @Column({ type: 'varchar', default: 'Pending' })
  status: LineItemStatus;

  @Column({ nullable: true })
  voidedBy: string;

  @Column({ nullable: true })
  voidReason: string;

  @CreateDateColumn()
  createdAt: Date;
}

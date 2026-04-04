import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import type { KDSStation } from '../../products/entities/category.entity';

export type TicketType = 'NEW' | 'ADDON' | 'CANCEL';
export type TicketStage = 'TO_COOK' | 'PREPARING' | 'DONE';

@Entity('kds_tickets')
export class KDSTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  /** Short display number from the order, e.g. ORD-ABC */
  @Column({ nullable: true })
  orderNumber: string;

  /** Table number string or null for takeaway */
  @Column({ nullable: true })
  tableNumber: string;

  /** Which station this ticket is routed to */
  @Column({ type: 'varchar', default: 'KITCHEN' })
  station: KDSStation;

  @Column({ type: 'varchar', default: 'NEW' })
  type: TicketType;

  @Column({ type: 'varchar', default: 'TO_COOK' })
  stage: TicketStage;

  @Column({ type: 'jsonb', default: '[]' })
  items: {
    itemId: string;
    name: string;
    quantity: number;
    note?: string | null;
    modifiers: { name: string; price: number }[];
  }[];

  @CreateDateColumn()
  receivedAt: Date;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}

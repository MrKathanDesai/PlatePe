import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ingredient } from './ingredient.entity';

export type InventoryTransactionType =
  | 'MANUAL_ADJUSTMENT'
  | 'IMPORT'
  | 'ORDER_CONSUMPTION'
  | 'ORDER_REPLENISHMENT';

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ingredient, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient;

  @Column()
  ingredientId: string;

  @Column({ type: 'varchar' })
  type: InventoryTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantityDelta: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  balanceAfter: number | null;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}

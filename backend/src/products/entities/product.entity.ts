import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Modifier } from './modifier.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ nullable: true })
  categoryId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ default: -1 })
  stockQty: number;

  @Column({ default: 10 })
  lowStockThreshold: number;

  @Column({ default: false })
  is86d: boolean;

  @Column({ default: true })
  sendToKitchen: boolean;

  @Column({ nullable: true, type: 'varchar' })
  image: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Modifier)
  @JoinTable({ name: 'product_modifiers' })
  modifiers: Modifier[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

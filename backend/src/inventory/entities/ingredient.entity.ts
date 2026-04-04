import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ingredients')
@Unique(['code'])
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column()
  baseUnit: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  onHandQty: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  lowStockThreshold: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  parLevel: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  costPerUnit: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

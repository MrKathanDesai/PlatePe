import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type KDSStation = 'KITCHEN' | 'BREWBAR';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  sortOrder: number;

  /** Which KDS station receives tickets for products in this category */
  @Column({ type: 'varchar', default: 'KITCHEN' })
  station: KDSStation;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

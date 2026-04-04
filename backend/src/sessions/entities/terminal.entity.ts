import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('terminals')
export class Terminal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'varchar', nullable: true })
  lockedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

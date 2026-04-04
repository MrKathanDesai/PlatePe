import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Terminal } from './terminal.entity';

export type SessionStatus = 'ACTIVE' | 'CLOSED';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Terminal)
  @JoinColumn({ name: 'terminalId' })
  terminal: Terminal;

  @Column()
  terminalId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  openingBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  closingBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discrepancy: number;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: SessionStatus;

  @CreateDateColumn()
  startTime: Date;

  @Column({ nullable: true })
  endTime: Date;
}

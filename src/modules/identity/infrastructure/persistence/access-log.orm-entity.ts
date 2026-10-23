import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of the `access_log` audit table. */
@Entity({ name: 'access_log' })
export class AccessLogOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'integer', default: 0 })
  userId: number;

  @Column({ type: 'varchar', length: 30, default: '' })
  role: string;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  module: string;

  @Column({ type: 'boolean', default: true })
  allowed: boolean;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, default: '0.0.0.0' })
  ipAddress: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date;
}

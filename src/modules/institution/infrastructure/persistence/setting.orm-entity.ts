import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mapping of the key/value `settings` table. */
@Entity({ name: 'settings' })
export class SettingOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}

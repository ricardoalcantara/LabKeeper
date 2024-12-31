import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from 'sequelize-typescript';
import { Host } from './host.model';

@Table({
  tableName: 'ip_addresses',
})
export class IpAddress extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id: number;

  @ForeignKey(() => Host)
  hostId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  address: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  cidrMask: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  macAddress: string;
}

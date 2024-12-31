import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from 'sequelize-typescript';
import { Host } from './host.model';

@Table({
  tableName: 'services',
})
export class Service extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id: number;

  @ForeignKey(() => Host)
  hostId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  port: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  protocol: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  serviceName: string;
}

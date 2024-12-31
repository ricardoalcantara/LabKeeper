import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { Service } from './service.model';
import { IpAddress } from './ip-address.model';

@Table({
  tableName: 'Hosts',
})
export class Host extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  hostname: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  description: string;

  @HasMany(() => Service)
  services: Service[];

  @HasMany(() => IpAddress)
  ipAddresses: IpAddress[];
}

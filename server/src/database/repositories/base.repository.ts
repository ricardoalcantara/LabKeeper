import { Model, ModelCtor } from 'sequelize-typescript';
import { WhereOptions, CreationAttributes } from 'sequelize';

export abstract class BaseRepository<T extends Model> {
  constructor(protected model: ModelCtor<T>) {}

  async create(data: CreationAttributes<T>): Promise<T> {
    return this.model.create(data);
  }

  async findAll(where?: WhereOptions<T>): Promise<T[]> {
    return this.model.findAll({ where });
  }

  async findOne(where: WhereOptions<T>): Promise<T | null> {
    return this.model.findOne({ where });
  }

  async findById(id: number): Promise<T | null> {
    return this.model.findByPk(id);
  }

  async update(id: number, data: Partial<T>): Promise<[number, T[]]> {
    return this.model.update(data, {
      where: { id } as any,
      returning: true,
    });
  }

  async delete(id: number): Promise<number> {
    return this.model.destroy({
      where: { id } as any,
    });
  }
}

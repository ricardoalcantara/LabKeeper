export type WhereClause<T> = {
  [P in keyof T]?: T[P] | { [key: string]: any };
};

export interface IBaseRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(where?: WhereClause<T>): Promise<T[]>;
  findOne(where: WhereClause<T>): Promise<T>;
  findById(id: number): Promise<T>;
  update(id: number, data: Partial<T>): Promise<[number, T[]]>;
  delete(id: number): Promise<number>;
}

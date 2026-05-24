export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  get(): T {
    const obj = this.pool.pop() ?? this.factory();
    this.reset(obj);
    return obj;
  }

  release(obj: T): void {
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }
}
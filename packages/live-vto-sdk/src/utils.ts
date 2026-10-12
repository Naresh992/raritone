export function assertNotNull<T>(v: T | null | undefined, msg: string): asserts v is T {
  if (v == null) throw new Error(msg);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simple typed event emitter */
export class Emitter<T extends Record<string, unknown>> {
  private m = new Map<keyof T, Set<(v: unknown) => void>>();
  on<K extends keyof T>(k: K, cb: (v: T[K]) => void): () => void {
    if (!this.m.has(k)) this.m.set(k, new Set());
    this.m.get(k)!.add(cb as (v: unknown) => void);
    return () => this.off(k, cb);
  }
  off<K extends keyof T>(k: K, cb: (v: T[K]) => void): void {
    this.m.get(k)?.delete(cb as (v: unknown) => void);
  }
  emit<K extends keyof T>(k: K, v: T[K]): void {
    for (const cb of this.m.get(k) ?? []) cb(v);
  }
  removeAll(): void {
    this.m.clear();
  }
}

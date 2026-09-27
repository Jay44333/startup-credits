export class EventBus<T extends Record<string, any[]>> {
  private handlers = new Map<keyof T, Set<(...args: any[]) => void>>();

  on<K extends keyof T>(event: K, handler: (...args: T[K]) => void): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (...args: any[]) => void);
  }

  off<K extends keyof T>(event: K, handler: (...args: T[K]) => void): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(handler as (...args: any[]) => void);
    if (set.size === 0) this.handlers.delete(event);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) handler(...args);
  }
}

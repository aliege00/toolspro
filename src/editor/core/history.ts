/**
 * Komut tabanlı geri al / yinele yığını.
 * Her komut ileri (apply) ve geri (revert) işlemini birlikte taşır.
 * Yığın en fazla 100 adım tutar; en eski adım düşer.
 */
export const HISTORY_LIMIT = 100;

export type Command<T> = {
  label?: string;
  apply: (state: T) => T;
  revert: (state: T) => T;
};

type Entry<T> = {
  command: Command<T>;
  /** Komutun son (birleştirilmiş olabilecek) sonucu. */
  result: T;
};

export class History<T> {
  private state: T;
  private readonly limit: number;
  private past: Entry<T>[] = [];
  private future: Entry<T>[] = [];

  constructor(initial: T, limit = HISTORY_LIMIT) {
    this.state = initial;
    this.limit = Math.max(1, Math.floor(limit));
  }

  get current(): T {
    return this.state;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get depth(): number {
    return this.past.length;
  }

  execute(command: Command<T>): T {
    const next = command.apply(this.state);
    this.past.push({ command, result: next });
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.state = next;
    return next;
  }

  /**
   * Son komutu yeni bir sonuçla değiştirir (kaydırıcı sürüklemesi gibi
   * birleştirilmiş hareketler). Geri alma yine hareketin başına döner.
   */
  amend(next: T): T {
    const last = this.past[this.past.length - 1];
    if (!last) return this.state;
    last.result = next;
    this.state = next;
    this.future = [];
    return this.state;
  }

  undo(): T {
    const entry = this.past.pop();
    if (!entry) return this.state;
    this.state = entry.command.revert(this.state);
    this.future.push(entry);
    if (this.future.length > this.limit) this.future.shift();
    return this.state;
  }

  redo(): T {
    const entry = this.future.pop();
    if (!entry) return this.state;
    this.state = entry.result;
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
    return this.state;
  }

  clear(next: T = this.state): void {
    this.state = next;
    this.past = [];
    this.future = [];
  }
}

/** İki proje anlık görüntüsünden ileri/geri komutu üretir. */
export function snapshotCommand<T>(before: T, after: T, label = "düzenleme"): Command<T> {
  return {
    label,
    apply: () => after,
    revert: () => before,
  };
}

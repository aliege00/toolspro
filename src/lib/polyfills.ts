/**
 * Eski Android WebView'lerde bulunmayan Promise yardımcıları.
 * pdf.js (legacy derlemesi dahil) Promise.withResolvers ve Promise.try
 * çağırdığı için bu dosya uygulama açılışında, pdf.js'ten önce yüklenir.
 */

type Resolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type PromiseStatics = {
  withResolvers?: <T>() => Resolvers<T>;
  try?: <T, A extends unknown[]>(
    callback: (...args: A) => T | PromiseLike<T>,
    ...args: A
  ) => Promise<T>;
};

const statics = Promise as unknown as PromiseStatics;

if (typeof statics.withResolvers !== "function") {
  statics.withResolvers = function withResolvers<T>(): Resolvers<T> {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof statics.try !== "function") {
  statics.try = function promiseTry<T, A extends unknown[]>(
    callback: (...args: A) => T | PromiseLike<T>,
    ...args: A
  ): Promise<T> {
    return new Promise<T>((resolve) => resolve(callback(...args)));
  };
}

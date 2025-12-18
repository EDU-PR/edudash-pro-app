// Polyfills for older JavaScript engines (like older Hermes versions)

// Promise.allSettled polyfill
if (!Promise.allSettled) {
  // Match the standard lib signature (best-effort) and keep implementation simple.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Promise as any).allSettled = function <T>(
    values: Iterable<T | PromiseLike<T>>
  ): Promise<PromiseSettledResult<Awaited<T>>[]> {
    const list = Array.from(values);
    return Promise.all(
      list.map((p) =>
        Promise.resolve(p)
          .then((value) => ({ status: 'fulfilled' as const, value: value as Awaited<T> }))
          .catch((reason) => ({ status: 'rejected' as const, reason }))
      )
    );
  };
}

// Export for TypeScript module resolution
export {};
/** A value that may come right away or later. */
export type Awaitable<Value> = Value | Promise<Value>;

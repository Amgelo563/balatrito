const defaultHost = 'localhost';
const defaultAddress = `${defaultHost}:9000`;

/** Splits a `host:port` address, defaulting to the local table. */
export function parseAddress(address: string = defaultAddress): {
  host: string;
  port: number;
} {
  const separator = address.lastIndexOf(':');
  return {
    host: address.slice(0, separator) || defaultHost,
    port: Number(address.slice(separator + 1)),
  };
}

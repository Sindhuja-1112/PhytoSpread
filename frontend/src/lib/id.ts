export function createUniqueId(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const values = cryptoApi.getRandomValues(new Uint32Array(2));
    return `${values[0].toString(16)}-${values[1].toString(16)}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

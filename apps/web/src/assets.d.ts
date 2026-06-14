// Kernel binaries imported as URLs so Vite emits them as hashed assets and
// pal-web fetches them at runtime.
declare module '*.bsp?url' {
  const src: string;
  export default src;
}
declare module '*.tls?url' {
  const src: string;
  export default src;
}
declare module '*.tpc?url' {
  const src: string;
  export default src;
}
declare module '*.ti?url' {
  const src: string;
  export default src;
}
declare module '@bessel/catalog/examples/cassini' {
  const catalog: unknown;
  export default catalog;
}

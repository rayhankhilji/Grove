/** Vite inlines these at build time, so persona prose ships inside the bundle. */
declare module '*.md?raw' {
  const content: string
  export default content
}

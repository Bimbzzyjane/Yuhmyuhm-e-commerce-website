/**
 * Ambient declarations for non-code imports.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `import './globals.css'` is a side-effect-only import. TypeScript only lets
 * those resolve through an ambient module declaration, and Next.js no longer
 * ships one (`next/types/global.d.ts` is gone in Next 15). On TypeScript 5.9 the
 * gap is invisible because `noUncheckedSideEffectImports` defaults to `false`,
 * but TypeScript 6/7 enable it — and then the exact errors appear:
 *
 *   src/app/layout.tsx(6,8):    error TS2307: Cannot find module './globals.css'
 *   src/app/not-found.tsx(2,8): error TS2307: Cannot find module './globals.css'
 *
 * Declaring them here makes the project typecheck identically on every
 * TypeScript version, with no dependency on Next-generated (and git-ignored)
 * files such as `next-env.d.ts` or `.next/types`.
 *
 * Verify with:
 *   npx tsc --noEmit --noUncheckedSideEffectImports
 */

// Stylesheets. Imported for their side effect; they have no type surface.
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.less';

// CSS Modules, in case one is introduced later. The shape matches what Next
// generates: a map of class names.
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
declare module '*.module.scss' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

// Static assets imported as modules return their resolved URL.
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.avif' {
  const src: string;
  export default src;
}
declare module '*.ico' {
  const src: string;
  export default src;
}
declare module '*.woff' {
  const src: string;
  export default src;
}
declare module '*.woff2' {
  const src: string;
  export default src;
}

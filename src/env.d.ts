/// <reference types="astro/client" />

// Astro's client types cover `?url` / `?raw` asset imports, but not the
// `?astro-rerun` query used to force a browser script to re-evaluate on
// every ClientRouter navigation (see src/components/MusicPlayer.astro).
// Without this declaration `astro check` reports ts(2882) for the
// side-effect import and `npm run build` fails, because build runs the
// type check first.
declare module '*.js?astro-rerun';

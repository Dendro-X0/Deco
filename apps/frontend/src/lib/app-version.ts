/** Injected at build time from the monorepo root `package.json`. */
export const APP_VERSION =
  typeof __DECO_APP_VERSION__ !== 'undefined' ? __DECO_APP_VERSION__ : '0.0.0';

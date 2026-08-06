import type { ReactNode } from 'react'

/**
 * Provider marks in their real brand geometry and colours, used purely to
 * identify each service in the Connections list. Drawn as paths so they stay
 * crisp at any size and add no network requests under the strict CSP.
 */
const MARKS: Record<string, (size: number) => ReactNode> = {
  google: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.8 5.2-.1.3C7.9 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-.3l-6.9-5.3-.2.1a22 22 0 0 0 0 19.8l7.1-5.5z"
      />
      <path
        fill="#EA4335"
        d="M24 10.1c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.9 29.9 1.9 24 1.9 15.4 1.9 7.9 6.8 4.4 14.1l7.1 5.5C13.3 14.2 18.2 10.1 24 10.1z"
      />
    </svg>
  ),

  microsoft: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#F25022" d="M6 6h17v17H6z" />
      <path fill="#7FBA00" d="M25 6h17v17H25z" />
      <path fill="#00A4EF" d="M6 25h17v17H6z" />
      <path fill="#FFB900" d="M25 25h17v17H25z" />
    </svg>
  ),

  slack: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#36C5F0" d="M14 28.5a4.5 4.5 0 1 1-4.5-4.5H14zm2.3 0a4.5 4.5 0 0 1 9 0v11.2a4.5 4.5 0 1 1-9 0z" />
      <path fill="#2EB67D" d="M20.8 14a4.5 4.5 0 1 1 4.5-4.5V14zm0 2.3a4.5 4.5 0 0 1 0 9H9.5a4.5 4.5 0 1 1 0-9z" />
      <path fill="#ECB22E" d="M35.2 20.8a4.5 4.5 0 1 1 4.5 4.5h-4.5zm-2.3 0a4.5 4.5 0 0 1-9 0V9.5a4.5 4.5 0 1 1 9 0z" />
      <path fill="#E01E5A" d="M28.4 35.2a4.5 4.5 0 1 1-4.5 4.5v-4.5zm0-2.3a4.5 4.5 0 0 1 0-9h11.3a4.5 4.5 0 1 1 0 9z" />
    </svg>
  ),

  linkedin: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="6" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M15.6 19.3h-5v16.2h5zM13.1 12a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8zM37.5 26.6c0-4.7-2.5-6.9-5.9-6.9-2.7 0-3.9 1.5-4.6 2.6v-2.2h-5v16.2h5v-9c0-.5 0-1 .2-1.3.4-1 1.3-1.9 2.7-1.9 1.9 0 2.6 1.4 2.6 3.5v8.7h5z"
      />
    </svg>
  ),

  notion: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="42" height="42" x="3" y="3" rx="5" fill="#fff" stroke="#111" strokeWidth="2.5" />
      <path
        fill="#111"
        d="M15 34V15.4l3.9-.4 10 13.3V15.6l-2.4-.5v-1l6.9-.5v1l-1.9.6V34l-2.9.4-10.6-14.1v12.2l2.6.5v1z"
      />
    </svg>
  ),

  linear: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="10" fill="#5E6AD2" />
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
        <path d="M9 27.5 20.5 39" />
        <path d="M8.4 21 27 39.6" />
        <path d="M9.8 14.8 33.2 38.2" />
        <path d="M15 9.6 38.4 33" />
      </g>
    </svg>
  ),

  github: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M24 3.5A20.5 20.5 0 0 0 17.5 43.5c1 .2 1.4-.4 1.4-1v-3.7c-5.7 1.2-6.9-2.7-6.9-2.7-.9-2.4-2.3-3-2.3-3-1.9-1.3.1-1.2.1-1.2 2.1.1 3.2 2.1 3.2 2.1 1.8 3.1 4.8 2.2 6 1.7.2-1.3.7-2.2 1.3-2.7-4.6-.5-9.4-2.3-9.4-10.2 0-2.3.8-4.1 2.1-5.6-.2-.5-.9-2.6.2-5.4 0 0 1.7-.6 5.6 2.1a19.4 19.4 0 0 1 10.2 0c3.9-2.7 5.6-2.1 5.6-2.1 1.1 2.8.4 4.9.2 5.4a8 8 0 0 1 2.1 5.6c0 7.9-4.8 9.7-9.4 10.2.7.6 1.4 1.9 1.4 3.8v5.6c0 .6.4 1.2 1.4 1A20.5 20.5 0 0 0 24 3.5z"
      />
    </svg>
  ),

  todoist: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="10" fill="#E44332" />
      <g stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
        <path d="M13 16.5 22 21.7 13 26.9" opacity="0" />
        <path d="M12.5 17.8 21.5 12.6" />
        <path d="M12.5 25 21.5 19.8" />
        <path d="M12.5 32.2 21.5 27" />
        <path d="M25.5 15.6h10" />
        <path d="M25.5 22.8h10" />
        <path d="M25.5 30h10" />
      </g>
    </svg>
  ),

  apple: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M33.7 25.4c0-4.4 3.6-6.5 3.8-6.6-2.1-3-5.3-3.5-6.4-3.5-2.7-.3-5.3 1.6-6.7 1.6-1.4 0-3.5-1.6-5.8-1.5-3 .04-5.7 1.7-7.2 4.4-3.1 5.4-.8 13.3 2.2 17.7 1.5 2.1 3.2 4.5 5.5 4.4 2.2-.1 3-1.4 5.7-1.4s3.4 1.4 5.8 1.4c2.4 0 3.9-2.1 5.3-4.3 1.7-2.4 2.4-4.8 2.4-4.9-.1-.05-4.6-1.8-4.6-7.3zM29.3 12.2c1.2-1.5 2-3.5 1.8-5.5-1.7.07-3.9 1.2-5.2 2.6-1.1 1.3-2.1 3.3-1.8 5.3 1.9.1 3.9-1 5.2-2.4z"
      />
    </svg>
  ),

  discord: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#5865F2" />
      <path
        fill="#fff"
        d="M32.6 15.4a22 22 0 0 0-5.4-1.7l-.3.7c-1.9-.3-3.8-.3-5.7 0l-.3-.7c-1.9.3-3.7.9-5.4 1.7-3.4 5.1-4.3 10-3.9 14.9a22 22 0 0 0 6.7 3.4l1.3-2.2c-.7-.3-1.4-.6-2.1-1l.5-.4c4 1.9 8.7 1.9 12.7 0l.5.4c-.7.4-1.4.7-2.1 1l1.3 2.2a22 22 0 0 0 6.7-3.4c.5-5.7-.9-10.6-3.9-14.9zM19.5 27.4c-1.3 0-2.4-1.2-2.4-2.7s1-2.7 2.4-2.7c1.3 0 2.4 1.2 2.4 2.7s-1.1 2.7-2.4 2.7zm9 0c-1.3 0-2.4-1.2-2.4-2.7s1-2.7 2.4-2.7c1.3 0 2.4 1.2 2.4 2.7s-1.1 2.7-2.4 2.7z"
      />
    </svg>
  ),

  telegram: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#229ED9" />
      <path
        fill="#fff"
        d="M11.5 23.4 33.9 14c1.1-.4 2.1.3 1.7 1.9l-3.8 18c-.3 1.3-1.1 1.6-2.2.9l-6.1-4.5-2.9 2.8c-.3.3-.6.6-1.2.6l.4-6.2 11.3-10.2c.5-.4-.1-.7-.7-.3l-14 8.8-6-1.9c-1.3-.4-1.3-1.3.3-1.9z"
      />
    </svg>
  ),

  x: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#0F1419" />
      <path
        fill="#fff"
        d="M27.6 21.6 37 11h-2.2l-8.2 9.2L20.1 11H12l9.9 14.1L12 36.2h2.2l8.6-9.7 6.9 9.7H38zm-3 3.4-1-1.4-8-11.1h3.4l6.4 9 1 1.4 8.3 11.7h-3.4z"
      />
    </svg>
  ),

  stripe: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#635BFF" />
      <path
        fill="#fff"
        d="M22.6 19.8c0-1.1 1-1.6 2.5-1.6 2.2 0 5 .7 7.2 1.9v-6.7c-2.4-.9-4.8-1.3-7.2-1.3-5.9 0-9.8 3-9.8 8.1 0 7.9 10.9 6.6 10.9 10 0 1.3-1.1 1.8-2.7 1.8-2.4 0-5.5-1-7.9-2.3v6.8c2.7 1.1 5.4 1.6 7.9 1.6 6 0 10.2-2.9 10.2-8.1 0-8.5-11.1-6.9-11.1-10.2z"
      />
    </svg>
  ),

  vercel: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="currentColor" d="M24 7 43 40H5z" />
    </svg>
  ),

  asana: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="13.5" r="7.5" fill="#F06A6A" />
      <circle cx="13.5" cy="31.5" r="7.5" fill="#F06A6A" />
      <circle cx="34.5" cy="31.5" r="7.5" fill="#F06A6A" />
    </svg>
  ),

  jira: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#2684FF" d="M24 4 42 22a4 4 0 0 1 0 5.6L24 46l-6-6 12-12-12-12z" />
      <path fill="#0052CC" d="M24 4 6 22a4 4 0 0 0 0 5.6L24 46l6-6-12-12 12-12z" opacity="0.85" />
    </svg>
  ),

  airtable: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFBF00" d="M22.2 8.4 5.6 15.2c-1.2.5-1.2 2.2 0 2.7l16.7 6.6c1.1.4 2.3.4 3.4 0l16.7-6.6c1.2-.5 1.2-2.2 0-2.7L25.8 8.4c-1.1-.5-2.4-.5-3.6 0z" />
      <path fill="#26B5F8" d="M24 27.4v13.1c0 1 1 1.7 1.9 1.3l16.4-6.4c.6-.2 1-.8 1-1.4V21c0-1-1-1.7-1.9-1.3L25 26.1c-.6.2-1 .8-1 1.3z" />
      <path fill="#ED3049" d="M20.9 28 16 30.3 5.5 35.4c-.9.5-2.1-.2-2.1-1.3V21.1c0-.4.2-.7.5-1l.6-.4c.4-.2.9-.3 1.3-.1l15 5.9c.8.3.9 1.4.1 1.7z" />
    </svg>
  ),

  sentry: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#362D59" />
      <path
        fill="#fff"
        d="M24 11.5c-.9 0-1.7.5-2.1 1.2l-3.6 6.2 1.9 1.1 3.6-6.2c.1-.2.4-.2.5 0l9.9 17.1c.1.2 0 .4-.3.4h-3.1c0-3.6-1.3-7-3.6-9.7l-1.7 1.4a12.6 12.6 0 0 1 3.1 8.3v1.3c0 .5.4.9.9.9h4.4c1.7 0 2.8-1.9 1.9-3.4L26.1 12.7c-.4-.7-1.2-1.2-2.1-1.2zm-6.7 11.6-1.7 3c2.7 1.6 4.5 4.4 4.8 7.6h-6.7c-.2 0-.4-.2-.3-.4l1.7-2.9c-.6-.4-1.3-.7-2-.9l-1.7 2.9c-.9 1.5.2 3.4 1.9 3.4h8.9c.5 0 .9-.4.9-.9 0-4.7-2.4-8.8-6-11.2z"
      />
    </svg>
  ),

  hubspot: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FF7A59"
        d="M33.7 19.3v-4.5a3.5 3.5 0 1 0-3.4 0v4.5c-1.6.3-3 1-4.2 2L14.8 12.6c.1-.3.1-.6.1-.9a4.2 4.2 0 1 0-4.2 4.2c.7 0 1.4-.2 2-.5l11.2 8.7a8.9 8.9 0 0 0 .2 9.4l-3.4 3.4c-.3-.1-.6-.1-.8-.1a3.9 3.9 0 1 0 3.9 3.9c0-.3 0-.6-.1-.8l3.4-3.4a9 9 0 1 0 6.6-16.2zm-1.7 13.5a4.6 4.6 0 1 1 0-9.2 4.6 4.6 0 0 1 0 9.2z"
      />
    </svg>
  ),

  calendly: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="21" fill="#006BFF" />
      <path
        fill="#fff"
        d="M31.3 29.4c-1.2 1-2.7 2.2-5.4 2.2h-1.6c-2 0-3.7-.7-5-2.1-1.2-1.3-1.9-3.1-1.9-5.2v-.6c0-2.1.7-3.9 1.9-5.2 1.3-1.4 3-2.1 5-2.1h1.6c2.7 0 4.2 1.2 5.4 2.2.9-.9 1.6-2 2.1-3.2-.6-.7-1.3-1.3-2-1.8-1.6-1.1-3.5-1.7-5.5-1.7h-1.6c-3.1 0-5.9 1.1-7.9 3.2-2 2-3.1 4.9-3.1 8.1v.6c0 3.2 1.1 6 3.1 8.1 2 2.1 4.8 3.2 7.9 3.2h1.6c2 0 3.9-.6 5.5-1.7.7-.5 1.4-1.1 2-1.8-.5-1.2-1.2-2.3-2.1-3.2z"
      />
    </svg>
  ),

  brave: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FB542B"
        d="m24 4 4.6 4.8h5.6l2 5.4 4.2 4.4-1.6 4.6 1.6 4.8-6.6 12c-1.6 2.8-2.4 3.8-4 4.8L24 44l-5.8-3.2c-1.6-1-2.4-2-4-4.8l-6.6-12L9.2 23l-1.6-4.6 4.2-4.4 2-5.4h5.6z"
      />
      <path fill="#fff" d="m24 15.4 4.8 8.6-4.8 3.4-4.8-3.4zm0 15.2 4.4-2.6 1.4 3-5.8 4.4-5.8-4.4 1.4-3z" />
    </svg>
  ),

  /* ── Model providers ─────────────────────────────────────────────────── */

  anthropic: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M28.4 10h-5.9L33.8 38h6zM14.6 10 3.3 38h6.1l2.3-6h11.8l2.3 6h6.1L20.6 10zm-1 16.8 3.9-10.1 3.9 10.1z"
      />
    </svg>
  ),

  openai: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M41.7 20.1a10.6 10.6 0 0 0-.9-8.7 10.7 10.7 0 0 0-11.5-5.1A10.6 10.6 0 0 0 21.3 3a10.7 10.7 0 0 0-10.2 7.4 10.6 10.6 0 0 0-7.1 5.2 10.7 10.7 0 0 0 1.3 12.5 10.6 10.6 0 0 0 .9 8.7 10.7 10.7 0 0 0 11.5 5.1A10.6 10.6 0 0 0 26.7 45a10.7 10.7 0 0 0 10.2-7.4 10.6 10.6 0 0 0 7.1-5.2 10.7 10.7 0 0 0-1.3-12.3zM26.7 41.8a7.9 7.9 0 0 1-5.1-1.8l.3-.1 8.5-4.9a1.4 1.4 0 0 0 .7-1.2V21.8l3.6 2.1v9.9a8 8 0 0 1-7.9 8zM9.7 34.5a7.9 7.9 0 0 1-.9-5.3l.3.2 8.5 4.9c.4.3 1 .3 1.4 0l10.4-6v4.1l-8.6 5a8 8 0 0 1-10.8-2.9zM7.4 17.7A7.9 7.9 0 0 1 11.6 14.3v10.1c0 .5.3 1 .7 1.2l10.3 6-3.6 2.1-8.6-5a8 8 0 0 1-3-10.9zm29.6 6.9-10.4-6 3.6-2.1 8.6 5a8 8 0 0 1-1.3 14.4V25.7c0-.5-.2-1-.6-1.2zm3.6-5.4-.3-.2-8.5-4.9a1.4 1.4 0 0 0-1.4 0l-10.4 6v-4.1l8.6-5a8 8 0 0 1 11.9 8.3zM17.6 26.2 14 24.1v-9.9a8 8 0 0 1 13.1-6.1l-.3.1-8.5 4.9c-.4.3-.7.7-.7 1.2zm1.9-4.2 4.6-2.7 4.6 2.7v5.3l-4.6 2.7-4.6-2.7z"
      />
    </svg>
  ),

  deepseek: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#4D6BFE" />
      <path
        fill="#fff"
        d="M36.4 15.6c-.4-.2-.6.1-.9.3-.1.1-.2.2-.3.4-.7.8-1.6 1.3-2.7 1.2-1.6-.1-3 .4-4.2 1.6-.3-1.5-1.1-2.4-2.4-3-.7-.3-1.4-.6-1.9-1.2-.3-.4-.4-.9-.5-1.4-.1-.3-.2-.4-.5-.4-.9.4-1.4 1.5-1.2 2.7.4 1.4 1.4 2.2 2.6 2.8.1.1.3.1.4.2-.3.1-.6.2-.9.3-1 .3-1.9.8-2.7 1.6-.2-.7-.4-1.4-.4-2.1 0-.4-.1-.7-.6-.8-1.1-.2-2.1-.7-3-1.4-1-.8-1.3-1.9-.3-3 .5-.6 1.2-.9 1.9-.7.9.2 1.6.7 2.2 1.4l.4.4c.4.4.9.4 1.2 0 .3-.3.3-.7 0-1.1-.2-.3-.5-.6-.8-.8-1.2-1-2.6-1.4-4-1.1-2 .5-3.2 2.4-2.8 4.5.3 1.5 1.2 2.6 2.4 3.4-.3.9-.4 1.8-.3 2.7.2 2.9 1.8 5.2 4.4 6.4 1.3.6 2.7.8 4.1.6-.4.9-1 1.7-1.8 2.3-.4.3-.5.7-.2 1.1.3.4.7.4 1.1.1 1.6-1.2 2.7-2.7 3.2-4.6 1.4-.5 2.6-1.4 3.5-2.7 1.4-2 1.9-4.2 1.5-6.6-.1-.5 0-.8.4-1.1.9-.7 1.6-1.6 1.8-2.8.1-.3.1-.7-.1-.8zm-8.2 10.3c-.2-.2-.1-.5.2-.9l.6-.6c.9-.9.9-1.9 0-2.8-.4-.4-.9-.6-1.5-.6-.3 0-.5-.1-.7-.4.6-.6 1.4-.8 2.2-.6 1.4.3 2.4 1.5 2.4 3 0 1.4-.9 2.6-2.2 3-.4.1-.7 0-1-.1z"
      />
    </svg>
  ),

  groq: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#F55036" />
      <path
        fill="#fff"
        d="M24 11a13 13 0 1 0 8.2 23.1l3 3 2.6-2.6-3-3A13 13 0 0 0 24 11zm0 4.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2z"
      />
    </svg>
  ),

  openrouter: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#0B0B0C" />
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M9 18h7l7 6h9" />
        <path d="M9 30h7l7-6" />
      </g>
      <circle cx="35" cy="24" r="4.5" fill="#fff" />
    </svg>
  ),

  ollama: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M16.4 6c-2 0-3.3 1.9-3.9 4.1-.4 1.5-.5 3.2-.4 4.9-2.3 2.3-3.7 5.4-3.7 8.8 0 1.7.4 3.4 1 4.9-1 1.7-1.6 3.6-1.6 5.6 0 2 .5 3.6 1.3 4.9.5.8 1.4 1 2.1.5.7-.5.9-1.4.4-2.1-.5-.8-.8-1.8-.8-3.3 0-1 .2-2 .6-2.9.6.7 1.3 1.3 2 1.8-.3.9-.5 1.9-.5 2.9 0 1.4.4 2.6 1 3.6.5.7 1.4.9 2.1.4.7-.5.9-1.4.4-2.1-.3-.4-.4-1-.4-1.9 0-.4 0-.7.1-1 2.1.8 4.5 1.3 7 1.3s4.9-.5 7-1.3c.1.3.1.6.1 1 0 .9-.1 1.5-.4 1.9-.5.7-.3 1.6.4 2.1.7.5 1.6.3 2.1-.4.6-1 1-2.2 1-3.6 0-1-.2-2-.5-2.9.7-.5 1.4-1.1 2-1.8.4.9.6 1.9.6 2.9 0 1.5-.3 2.5-.8 3.3-.5.7-.3 1.6.4 2.1.7.5 1.6.3 2.1-.5.8-1.3 1.3-2.9 1.3-4.9 0-2-.6-3.9-1.6-5.6.6-1.5 1-3.2 1-4.9 0-3.4-1.4-6.5-3.7-8.8.1-1.7 0-3.4-.4-4.9C34.9 7.9 33.6 6 31.6 6c-2.2 0-3.6 2.2-4.2 4.7-1.1-.2-2.2-.4-3.4-.4s-2.3.1-3.4.4C20 8.2 18.6 6 16.4 6zm3.1 20.7c1 0 1.9.8 1.9 1.9 0 1-.8 1.9-1.9 1.9s-1.9-.8-1.9-1.9c0-1 .8-1.9 1.9-1.9zm9 0c1 0 1.9.8 1.9 1.9 0 1-.8 1.9-1.9 1.9s-1.9-.8-1.9-1.9c0-1 .8-1.9 1.9-1.9zM24 32.2c1.7 0 3 .8 3 1.9s-1.3 1.9-3 1.9-3-.8-3-1.9 1.3-1.9 3-1.9z"
      />
    </svg>
  ),

  fish: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#111827" />
      <path
        fill="#fff"
        d="M11 24c4-6.5 9.3-9.8 15.8-9.8 3.2 0 6 .8 8.4 2.4l3.8-3.4v20.6l-3.8-3.4c-2.4 1.6-5.2 2.4-8.4 2.4C20.3 32.8 15 29.5 11 24zm18-2.6a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"
      />
    </svg>
  )
}

/**
 * A provider's mark.
 *
 * Anything with a drawn logo above gets it; anything else falls back to a
 * monogram tile. A deliberate initial beats a badly traced logo, and it
 * guarantees no row in the list is ever left with an empty square.
 *
 * The tile takes its colours from the theme tokens rather than a fixed pair,
 * so it inverts correctly in dark mode instead of going white-on-white.
 */
export const BrandMark = ({
  id,
  name,
  size = 22
}: {
  id: string
  name?: string
  size?: number
}): ReactNode => {
  const drawn = MARKS[id]
  if (drawn) return drawn(size)

  const letter = (name ?? id).replace(/[^a-z]/gi, '').charAt(0).toUpperCase() || '?'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="var(--fg)" />
      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="600"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        fill="var(--bg)"
      >
        {letter}
      </text>
    </svg>
  )
}

export const hasBrandMark = (id: string): boolean => id in MARKS

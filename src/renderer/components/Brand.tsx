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
  )
}

export const BrandMark = ({ id, size = 22 }: { id: string; size?: number }): ReactNode =>
  MARKS[id]?.(size) ?? null

export const hasBrandMark = (id: string): boolean => id in MARKS

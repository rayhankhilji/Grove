import house from './_house.md?raw'

/**
 * The rules every agent inherits, on top of its own instructions.
 *
 * They live in Markdown for the same reason the personas do: a long, specific
 * account of how to behave is easier to write, read and argue with as prose
 * than as a string literal wedged into TypeScript.
 */
export const HOUSE_RULES = house.trim()

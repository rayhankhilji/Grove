import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import type { MeetingAttachment } from '@shared/types'
import { lit, osa } from './osa'

/**
 * Turns a dropped file into text the room can actually discuss.
 *
 * All of this is native: PDFs go through PDFKit via the JXA ObjC bridge, and
 * Office files are zip archives whose XML we read directly. No parsing
 * dependencies, and nothing leaves the machine before the call starts.
 */

const run = (command: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout)
    )
  })

/** Office XML → readable text, preserving paragraph and slide breaks. */
const stripXml = (xml: string): string =>
  xml
    .replace(/<a:br\s*\/>/g, '\n')
    .replace(/<\/a:p>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const fromPdf = async (path: string): Promise<string> => {
  const text = await osa<string>(
    `
    ObjC.import('Quartz')
    const url = $.NSURL.fileURLWithPath(${lit(path)})
    const doc = $.PDFDocument.alloc.initWithURL(url)
    if (!doc || doc.isNil()) { JSON.stringify('') } else { JSON.stringify(ObjC.unwrap(doc.string)) }
  `,
    45_000
  )
  return (text ?? '').trim()
}

const fromZipParts = async (path: string, glob: string): Promise<string> => {
  // `unzip -p` streams members to stdout; slide order follows the archive.
  const raw = await run('unzip', ['-p', path, glob])
  return stripXml(raw)
}

export const extractText = async (path: string): Promise<MeetingAttachment> => {
  const name = basename(path)
  const extension = extname(path).toLowerCase()

  try {
    switch (extension) {
      case '.pdf':
        return { name, text: await fromPdf(path) }
      case '.pptx':
      case '.key':
        return { name, text: await fromZipParts(path, 'ppt/slides/slide*.xml') }
      case '.docx':
        return { name, text: await fromZipParts(path, 'word/document.xml') }
      case '.xlsx':
        return { name, text: await fromZipParts(path, 'xl/sharedStrings.xml') }
      default:
        return { name, text: readFileSync(path, 'utf8') }
    }
  } catch (error) {
    return {
      name,
      text: `[Could not read ${name}: ${(error as Error).message}. Paste the contents into the brief instead.]`
    }
  }
}

export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'pptx',
  'docx',
  'xlsx',
  'key',
  'txt',
  'md',
  'csv',
  'json',
  'html'
]

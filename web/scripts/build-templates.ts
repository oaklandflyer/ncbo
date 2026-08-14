/**
 * Renders the club templates in `data/templates/*.md` to PDF.
 *
 * Uses pdfkit, which draws PDFs directly in JavaScript — no headless browser, no
 * conversion service, no account, no network. Run it offline and it works.
 *
 * The Markdown handled here is deliberately a small subset: headings, bullets,
 * checkboxes, tables, blockquotes, paragraphs and horizontal rules. The templates
 * are written to stay inside it. This is a document renderer for four known files,
 * not a general Markdown engine, and it should not grow into one.
 *
 *   npm run build:templates
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(here, '../../data/templates');
const MD_OUT = resolve(here, '../public/templates');
const PDF_OUT = resolve(here, '../public/templates');

const NAVY = '#0e1a2f';
const STEEL = '#1e4478';
const MUTED = '#4a5771';

interface Line {
  kind: 'h1' | 'h2' | 'bullet' | 'checkbox' | 'table' | 'quote' | 'rule' | 'text' | 'blank';
  text: string;
}

/** Strip the inline markers we use, since pdfkit draws plain runs. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/`(.+?)`/g, '$1');
}

function classify(raw: string): Line {
  const line = raw.replace(/\s+$/, '');
  if (line.trim() === '') return { kind: 'blank', text: '' };
  if (line.startsWith('# ')) return { kind: 'h1', text: plain(line.slice(2)) };
  if (line.startsWith('## ')) return { kind: 'h2', text: plain(line.slice(3)) };
  if (line.startsWith('---')) return { kind: 'rule', text: '' };
  if (line.startsWith('> ')) return { kind: 'quote', text: plain(line.slice(2)) };
  if (/^- \[ \] /.test(line)) return { kind: 'checkbox', text: plain(line.slice(6)) };
  if (/^[-*] /.test(line)) return { kind: 'bullet', text: plain(line.slice(2)) };
  if (line.startsWith('|')) return { kind: 'table', text: line };
  return { kind: 'text', text: plain(line) };
}

function renderPdf(markdown: string, title: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 64, bottom: 64, left: 64, right: 64 },
    info: { Title: title, Author: 'NCBO — National Collegiate Bodybuilding Organization' },
  });

  const width = doc.page.width - 128;

  for (const raw of markdown.split('\n')) {
    const line = classify(raw);

    switch (line.kind) {
      case 'h1':
        doc.moveDown(0.2).fillColor(NAVY).font('Helvetica-Bold').fontSize(20).text(line.text, { width });
        doc.moveDown(0.4);
        break;
      case 'h2':
        doc.moveDown(0.6).fillColor(STEEL).font('Helvetica-Bold').fontSize(13).text(line.text, { width });
        doc.moveDown(0.2);
        break;
      case 'bullet':
        doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(`•  ${line.text}`, {
          width: width - 12,
          indent: 12,
        });
        break;
      case 'checkbox':
        // "[ ]" rather than a ballot-box glyph: pdfkit's standard fonts encode
        // WinAnsi, and U+2610 comes out as mojibake. A bracket pair is uglier and
        // actually prints.
        doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(`[  ]  ${line.text}`, {
          width: width - 12,
          indent: 12,
        });
        break;
      case 'quote':
        doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(10.5).text(line.text, {
          width: width - 16,
          indent: 16,
        });
        break;
      case 'table': {
        const cells = line.text
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        // Separator row in a GitHub table — draw a rule instead of "---".
        if (cells.every((cell) => /^:?-+:?$/.test(cell))) {
          doc.moveDown(0.1);
          break;
        }
        doc.fillColor(NAVY).font('Helvetica').fontSize(9.5).text(cells.join('   |   '), { width });
        break;
      }
      case 'rule':
        doc.moveDown(0.3);
        doc
          .strokeColor('#d2e0f0')
          .lineWidth(1)
          .moveTo(64, doc.y)
          .lineTo(doc.page.width - 64, doc.y)
          .stroke();
        doc.moveDown(0.3);
        break;
      case 'text':
        doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(line.text, { width });
        break;
      case 'blank':
        doc.moveDown(0.45);
        break;
    }
  }

  doc
    .moveDown(1.5)
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(
      'NCBO club template. Your university\'s own sport club policy governs your club; where it ' +
        'differs from this template, follow your school. NCBO does not certify, insure or supervise ' +
        'any club.',
      { width },
    );

  return doc;
}

function main(): void {
  mkdirSync(MD_OUT, { recursive: true });
  mkdirSync(PDF_OUT, { recursive: true });

  const files = readdirSync(SOURCE_DIR).filter((file) => file.endsWith('.md'));
  if (files.length === 0) {
    throw new Error(`No templates found in ${SOURCE_DIR}`);
  }

  for (const file of files) {
    const markdown = readFileSync(join(SOURCE_DIR, file), 'utf8');
    const title = markdown.split('\n')[0]?.replace(/^#\s*/, '') ?? file;

    // The Markdown original is a deliverable too — clubs will want to edit it.
    writeFileSync(join(MD_OUT, file), markdown);

    const pdfPath = join(PDF_OUT, file.replace(/\.md$/, '.pdf'));
    const doc = renderPdf(markdown, title);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => writeFileSync(pdfPath, Buffer.concat(chunks)));
    doc.end();

    console.log(`  ${file} → ${file.replace(/\.md$/, '.pdf')}`);
  }
  console.log(`Wrote ${files.length} template(s) to ${PDF_OUT}`);
}

main();

// Draws docs-as-code markdown (Sprint 6Z, parseMarkdown in @kofc/shared) as React elements, never raw HTML, for the SOP
// Center and the bylaws preview. Navy text and rules on white; links open in place unless they leave the portal.
// The 'contrast' tone (Sprint 6A, Phase 4) is the phone's Visually Impaired palette for the SOP Center: bold white text
// on pitch black inside hc-gold rules and borders. MarkdownInline draws one line of inline markdown, for the help desk.
import { parseInline, parseMarkdown, type MarkdownBlock } from '@kofc/shared';
import { cx } from '@/components/ui';

export type MarkdownTone = 'standard' | 'contrast';

/** One line of inline markdown: **bold**, *italic*, `code` and safe [links](https://...). */
export function MarkdownInline({ text, tone = 'standard' }: { text: string; tone?: MarkdownTone }) {
  const contrast = tone === 'contrast';
  return (
    <>
      {parseInline(text).map((seg, i) => {
        switch (seg.kind) {
          case 'bold':
            return <strong key={i}>{seg.text}</strong>;
          case 'italic':
            return <em key={i}>{seg.text}</em>;
          case 'code':
            return (
              <code key={i} className={cx('rounded px-1 text-sm', contrast ? 'border border-hc-gold' : 'bg-line/40')}>
                {seg.text}
              </code>
            );
          case 'link': {
            const external = /^https:/i.test(seg.href);
            return (
              <a key={i} href={seg.href} className="font-bold underline" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {seg.text}
              </a>
            );
          }
          default:
            return <span key={i}>{seg.text}</span>;
        }
      })}
    </>
  );
}

const HEADING_LOOK = ['font-serif text-2xl font-bold', 'font-serif text-xl font-bold', 'text-lg font-bold', 'font-bold', 'font-bold', 'font-bold'];

function Block({ block, idPrefix, tone }: { block: MarkdownBlock; idPrefix: string; tone: MarkdownTone }) {
  const contrast = tone === 'contrast';
  const inline = (text: string) => <MarkdownInline text={text} tone={tone} />;
  switch (block.kind) {
    case 'heading': {
      const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2';
      return (
        <Tag
          id={`${idPrefix}-${block.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          className={cx(HEADING_LOOK[block.level - 1], contrast && block.level <= 2 && 'border-b-4 border-hc-gold pb-1')}
        >
          {inline(block.text)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p>
          {inline(block.text)}
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={block.ordered ? 'list-decimal pl-6' : 'list-disc pl-6'}>
          {block.items.map((item, i) => {
            const box = /^\[( |x|X)\]\s+(.*)$/.exec(item);
            return (
              <li key={i}>
                {box ? (
                  <>
                    <span aria-hidden="true">{box[1] === ' ' ? '☐' : '☑'} </span>
                    <span className="sr-only">{box[1] === ' ' ? '(to check) ' : '(checked) '}</span>
                    {inline(box[2])}
                  </>
                ) : (
                  inline(item)
                )}
              </li>
            );
          })}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote className={cx('border-l-8 py-1 pl-3', contrast ? 'border-hc-gold bg-black' : 'border-gold bg-white')}>
          {block.text.split('\n').map((line, i) => (
            <p key={i}>
              {inline(line)}
            </p>
          ))}
        </blockquote>
      );
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className={cx('w-full border-collapse', contrast ? 'text-base' : 'text-sm')}>
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cx('border-2 px-2 py-1 text-left', contrast ? 'border-hc-gold bg-black text-white' : 'border-navy bg-navy text-white')}
                  >
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={cx('px-2 py-1 align-top', contrast ? 'border-2 border-hc-gold' : 'border border-line')}>
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return (
        <pre className={cx('overflow-x-auto rounded p-3 text-sm', contrast ? 'border-2 border-hc-gold bg-black' : 'border border-line bg-line/20')}>
          {block.text}
        </pre>
      );
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.src} alt={block.alt} className={cx('max-w-full rounded', contrast ? 'border-4 border-hc-gold' : 'border border-line')} />;
    case 'rule':
      return <hr className={cx('border-t-2', contrast ? 'border-hc-gold' : 'border-gold')} />;
  }
}

/** A markdown document; `idPrefix` keeps heading anchors unique when several documents share a page. */
export function Markdown({ source, idPrefix = 'doc', tone = 'standard' }: { source: string; idPrefix?: string; tone?: MarkdownTone }) {
  return (
    <div className={cx('flex flex-col gap-3', tone === 'contrast' ? 'text-lg font-bold leading-relaxed text-white' : 'text-navy')}>
      {parseMarkdown(source).map((block, i) => (
        <Block key={i} block={block} idPrefix={idPrefix} tone={tone} />
      ))}
    </div>
  );
}

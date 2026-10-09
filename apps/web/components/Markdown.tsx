// Draws docs-as-code markdown (Sprint 6Z, parseMarkdown in @kofc/shared) as React elements, never raw HTML, for the SOP
// Center and the bylaws preview. Navy text and rules on white; links open in place unless they leave the portal.
// Sprint 6L Extension: the web draws every document in this one standard palette; the high-contrast Visually Impaired
// layout lives only in the phone app. MarkdownInline draws one line of inline markdown, for the help desk.
import { parseInline, parseMarkdown, type MarkdownBlock } from '@kofc/shared';

/** One line of inline markdown: **bold**, *italic*, `code` and safe [links](https://...). */
export function MarkdownInline({ text }: { text: string }) {
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
              <code key={i} className="rounded bg-line/40 px-1 text-sm">
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

function Block({ block, idPrefix }: { block: MarkdownBlock; idPrefix: string }) {
  const inline = (text: string) => <MarkdownInline text={text} />;
  switch (block.kind) {
    case 'heading': {
      const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2';
      return (
        <Tag
          id={`${idPrefix}-${block.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          className={HEADING_LOOK[block.level - 1]}
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
        <blockquote className="border-l-8 border-gold bg-white py-1 pl-3">
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
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-2 border-navy bg-navy px-2 py-1 text-left text-white"
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
                    <td key={c} className="border border-line px-2 py-1 align-top">
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
        <pre className="overflow-x-auto rounded border border-line bg-line/20 p-3 text-sm">
          {block.text}
        </pre>
      );
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.src} alt={block.alt} className="max-w-full rounded border border-line" />;
    case 'rule':
      return <hr className="border-t-2 border-gold" />;
  }
}

/** A markdown document; `idPrefix` keeps heading anchors unique when several documents share a page. */
export function Markdown({ source, idPrefix = 'doc' }: { source: string; idPrefix?: string }) {
  return (
    <div className="flex flex-col gap-3 text-navy">
      {parseMarkdown(source).map((block, i) => (
        <Block key={i} block={block} idPrefix={idPrefix} />
      ))}
    </div>
  );
}

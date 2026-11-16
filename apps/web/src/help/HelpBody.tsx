import { Fragment, type ReactNode } from 'react';

/**
 * Renders the small markup used by the help articles:
 * paragraphs, "- " bullets, "1. " steps, **bold**, [[id|text]] links to
 * other articles and [text](https://…) links to web pages.
 */
export function HelpBody({ text, onOpen }: { text: string; onOpen: (id: string) => void }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="help-body">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^- /.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2), onOpen)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\. /, ''), onOpen)}</li>
              ))}
            </ol>
          );
        }
        // A paragraph followed by bullets ("Messages you may see:\n- …").
        const firstBullet = lines.findIndex((l) => /^- /.test(l));
        if (firstBullet > 0 && lines.slice(firstBullet).every((l) => /^- /.test(l))) {
          return (
            <Fragment key={i}>
              <p>{inline(lines.slice(0, firstBullet).join(' '), onOpen)}</p>
              <ul>
                {lines.slice(firstBullet).map((l, j) => (
                  <li key={j}>{inline(l.slice(2), onOpen)}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(' '), onOpen)}</p>;
      })}
    </div>
  );
}

const TOKEN = /\*\*(.+?)\*\*|\[\[([\w-]+)\|(.+?)\]\]|\[(.+?)\]\((https:\/\/[^)\s]+)\)/g;

function inline(text: string, onOpen: (id: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2] !== undefined) {
      const id = m[2];
      out.push(
        <button key={key++} type="button" className="help-link" onClick={() => onOpen(id)}>
          {m[3]}
        </button>,
      );
    } else {
      out.push(
        <a key={key++} href={m[5]} target="_blank" rel="noreferrer">
          {m[4]}
        </a>,
      );
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

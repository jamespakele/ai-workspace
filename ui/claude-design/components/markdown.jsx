// Lightweight markdown → React renderer (no deps). Handles paragraphs, **bold**,
// *italic*, `inline code`, fenced ```code blocks```, - bullet lists, 1. ordered lists,
// and ### headings. Plus a typewriter cursor for streaming text.

function mdInline(text, keyBase) {
  // tokenize inline: `code`, **bold**, *italic*
  const out = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code className="md-code" key={`${keyBase}-${i}`}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${i}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyBase}-${i}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length; i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ md, cursor }) {
  const lines = (md || "").split("\n");
  const nodes = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3);
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++; // closing fence
      nodes.push(
        <pre className="md-pre" key={key++}>
          {lang && <span className="md-pre-lang">{lang}</span>}
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }
    // headings
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) { const L = h[1].length; nodes.push(React.createElement(`h${Math.min(L+1,5)}`, { className: "md-h", key: key++ }, mdInline(h[2], key))); i++; continue; }
    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      nodes.push(<ul className="md-ul" key={key++}>{items.map((it, k) => <li key={k}>{mdInline(it, `${key}-${k}`)}</li>)}</ul>);
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      nodes.push(<ol className="md-ol" key={key++}>{items.map((it, k) => <li key={k}>{mdInline(it, `${key}-${k}`)}</li>)}</ol>);
      continue;
    }
    // blank
    if (line.trim() === "") { i++; continue; }
    // paragraph (gather consecutive non-empty, non-special lines)
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !lines[i].trim().startsWith("```") && !/^#{1,4}\s/.test(lines[i])) { buf.push(lines[i]); i++; }
    nodes.push(<p className="md-p" key={key++}>{mdInline(buf.join(" "), key)}</p>);
  }
  if (cursor) {
    const lastNode = nodes[nodes.length - 1];
    nodes.push(<span className="md-cursor" key="cursor" />);
  }
  return <div className="md">{nodes}</div>;
}

Object.assign(window, { Markdown, mdInline });

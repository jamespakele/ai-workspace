import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CodeRenderer({ className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match?.[1] ?? "";

  if (match) {
    return (
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className="rounded-lg text-[11px]"
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    );
  }

  return (
    <code
      className="rounded bg-panel/80 px-1 font-mono text-[11px]"
      {...props}
    >
      {children}
    </code>
  );
}

export function Markdown({ content }) {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeRenderer,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

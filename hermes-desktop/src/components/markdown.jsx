export function Markdown({ content }) {
  return (
    <div className="prose prose-invert max-w-none">
      <p>{content}</p>
    </div>
  );
}

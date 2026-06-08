import { Button } from "./ui/button";

export function Composer() {
  return (
    <div className="border-t border-border px-6 py-4">
      <div className="rounded-2xl border border-border bg-panel p-4">
        <label className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Composer
        </label>
        <textarea
          className="mt-3 h-28 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-3 text-sm text-text outline-none placeholder:text-muted"
          placeholder="Composer stub for future gateway integration."
          readOnly
        />
        <div className="mt-4 flex justify-end">
          <Button className="bg-accent text-white hover:bg-accent/90">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

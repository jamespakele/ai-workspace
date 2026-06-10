import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement scrollIntoView, which the chat transcript uses.
window.HTMLElement.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

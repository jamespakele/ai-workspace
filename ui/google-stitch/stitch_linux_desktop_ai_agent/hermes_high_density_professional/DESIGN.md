---
name: Hermes High-Density Professional
colors:
  surface: '#1C1C1F'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#ccc3d8'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#303032'
  outline: '#958da1'
  outline-variant: '#4a4455'
  surface-tint: '#d2bbff'
  primary: '#d2bbff'
  on-primary: '#3f008e'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#732ee4'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffb784'
  on-tertiary: '#4f2500'
  tertiary-container: '#a15100'
  on-tertiary-container: '#ffe0cd'
  error: '#EF4444'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb784'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#713700'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  canvas: '#0F0F11'
  sidebar: '#161618'
  surface-raised: '#252529'
  border-subtle: '#2A2A2E'
  border-strong: '#3F3F46'
  text-primary: '#EEEEF0'
  text-secondary: '#A1A1AA'
  text-muted: '#71717A'
  nous-purple: '#7C3AED'
  success: '#10B981'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  tool-output:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  status-bar:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  status-bar-height: 28px
  gutter: 12px
  padding-container: 16px
  padding-compact: 8px
  padding-xs: 4px
---

## Brand & Style

The design system is engineered for **Hermes**, a professional developer tool that prioritizes focus, technical precision, and high information density. The brand personality is "The Quiet Assistant"—calm, efficient, and unobtrusive. It is designed to feel like a high-performance terminal combined with the refined layout of modern engineering tools like Linear and Claude Cowork.

The design style follows a **Corporate Minimalist** approach with **Tonal Layering**. It avoids unnecessary ornamentation, relying on strict grids, subtle depth through color shifts, and intentional typography to guide the developer's eye. The interface is "dark-mode-first," acknowledging the long-form usage patterns of engineers working in IDE-adjacent environments.

**Key visual principles:**
- **Density over Air:** Space is used to group related functions rather than simply provide "breathing room." Information is compact but legible.
- **Utility-First:** Every element must serve a functional purpose. Decorations like heavy shadows or vibrant gradients are replaced by subtle borders and monochromatic shifts.
- **Technical Texture:** Integration of monospaced fonts for data and code creates a familiar "hacker" aesthetic without sacrificing the accessibility of a GUI.

## Colors

The palette is optimized for long-duration coding sessions. It uses a **Deep Charcoal** foundation to reduce eye strain, moving away from pure black to allow for subtle depth through layering.

- **Primary (Nous Purple):** Used sparingly for active states, primary actions, and brand identification. 
- **Secondary (Neutral Blue):** Employed for interactive elements that are functional rather than promotional, such as links or utility icons.
- **Neutral Scale:** This is the workhorse of the system. We use a range of "off-blacks" and "warm-grays" to define the three-panel layout.
    - `Canvas` is the deepest layer (Main Chat View).
    - `Sidebar` provides a slight lift to differentiate the navigation.
    - `Surface` is used for cards, tool outputs, and the composer.

**Status Indicators:**
- Use the green and red status dots in the status bar for gateway connectivity. 
- Tool outputs should use a muted version of the primary or secondary color to denote "Thinking" or "Executing" states.

## Typography

The system utilizes a dual-font strategy to balance UI clarity with developer-centric data visualization.

1.  **UI Chrome (Inter):** A neutral, highly legible sans-serif used for all navigation, menus, settings, and assistant prose. It provides a modern, professional feel.
2.  **Code & Data (JetBrains Mono):** Chosen for its exceptional readability in technical contexts. Used for code blocks, tool call outputs, the status bar, and slash commands.

**Scale & Constraints:**
- Hierarchy is established through weight and color (Text Primary vs. Text Secondary) rather than large jumps in font size.
- The maximum font size in the app should rarely exceed 20px, maintaining the "Pro Tool" density.
- **Markdown Rendering:** Assistant responses should use `body-md`. Inside these responses, code blocks switch to `code-block`.

## Layout & Spacing

This design system uses a **Fixed-Fluid Hybrid** layout tailored for a desktop-native experience.

- **Sidebar (Fixed):** Locked at 260px. This maintains a predictable hit-area for the File Tree and Session History.
- **Main Chat View (Fluid):** Expands to fill the remaining horizontal space. Content within the chat view is constrained to a maximum readable width of 800px, centered, to prevent long lines of text.
- **Status Bar (Fixed):** A persistent 28px bar at the bottom for global state.

**Grid & Rhythm:**
- A **4px base grid** governs all spacing.
- UI components (like buttons and inputs) use 8px (`padding-compact`) internal horizontal padding.
- Section headers in the sidebar use `label-caps` with 12px vertical spacing to create clear semantic breaks.

## Elevation & Depth

Depth in this system is conveyed through **Tonal Layers** and **Low-Contrast Outlines**. We avoid physical shadows to maintain a flat, performant, and modern developer aesthetic.

1.  **Z-0 (Canvas):** The deepest layer, used for the main background of the chat thread.
2.  **Z-1 (Sidebar & Panels):** A slightly lighter shade to distinguish navigation from content.
3.  **Z-2 (Components):** Tool call cards and the Composer bar use a subtle background lift (`surface`) and a 1px border (`border-subtle`).
4.  **Floating States:** Slash command palettes and context menus use the `surface-raised` color with a slightly more prominent border (`border-strong`) to indicate they are temporary overlays. No shadows are required; the contrast in border strength provides sufficient separation.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness philosophy. This provides a modern touch without appearing "bubbly" or consumer-grade.

- **Standard Elements:** Buttons, inputs, and cards use a 4px (0.25rem) radius.
- **Container Elements:** Large panels or the main composer use an 8px (0.5rem) radius.
- **Chips & Badges:** Use a "Pill" shape (full rounding) for file attachments and status indicators to distinguish them from interactive buttons.

## Components

### Buttons & Inputs
- **Primary Button:** `nous-purple` background with white text. 4px radius. 
- **Ghost Button:** No background, `text-secondary` color, highlighting to `surface` on hover. Used for sidebar actions.
- **Composer:** A multi-line textarea with no focus ring; instead, the border color shifts from `border-subtle` to `nous-purple` on focus.

### ToolCallCard
- A container with a `surface` background and a 1px `border-subtle`.
- Header contains the tool name in `JetBrains Mono` (bold) and a collapse chevron.
- Content uses `tool-output` typography on a slightly darker background.

### File Tree
- Indentation of 12px per level.
- Active file uses a `surface` background across the full width of the sidebar.
- Dimmed text (`text-muted`) for ignored files like `node_modules`.

### Chat Messages
- **User:** Right-aligned or distinguished by a subtle `surface` background.
- **Assistant:** Standard canvas background to keep the focus on the content.
- **Thinking Blocks:** Collapsible sections with a dashed left border and `text-muted` font color.

### Slash Command Palette
- Floating menu with `surface-raised` background. 
- Selected items use `nous-purple` text with a subtle background highlight.
- Display command on the left and a brief description on the right.
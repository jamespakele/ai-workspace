// Inline SVG icon set for Hermes Desktop. Stroke-based, 1.6 weight, inherits currentColor.
const Icon = ({ d, size = 16, fill = "none", stroke = "currentColor", sw = 1.6, children, vb = 24, style }) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Hermes: (p) => (
    <Icon {...p} vb={24} fill="none">
      {/* winged-helm mark, abstract */}
      <path d="M6 9c0-3.3 2.7-6 6-6s6 2.7 6 6v3.5c0 3.6-2.7 6.5-6 6.5s-6-2.9-6-6.5V9Z" />
      <path d="M6 9.5 2.5 8M18 9.5 21.5 8M12 14v6" />
      <circle cx="9.4" cy="10" r=".9" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="10" r=".9" fill="currentColor" stroke="none" />
    </Icon>
  ),
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Icon>,
  Plus: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  ChevronDown: (p) => <Icon {...p} d="m6 9 6 6 6-6" />,
  ChevronRight: (p) => <Icon {...p} d="m9 6 6 6-6 6" />,
  Folder: (p) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h3.5l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  FolderOpen: (p) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h3.5l2 2.5H19a2 2 0 0 1 2 2" /><path d="M3 9.5h17.2a1 1 0 0 1 .97 1.24l-1.5 6A1 1 0 0 1 18.7 18H4.7a1 1 0 0 1-1-1V9.5Z" /></Icon>,
  File: (p) => <Icon {...p}><path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M13 3v5h5" /></Icon>,
  History: (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l2.5 1.5" /></Icon>,
  Paperclip: (p) => <Icon {...p} d="M20 11.5 12.5 19a4.5 4.5 0 0 1-6.4-6.4l8-8a3 3 0 0 1 4.3 4.3l-8 8a1.5 1.5 0 0 1-2.2-2.2l7.3-7.3" />,
  Send: (p) => <Icon {...p}><path d="M5 12h13" /><path d="m12 5 7 7-7 7" /></Icon>,
  Slash: (p) => <Icon {...p} d="M15 4 9 20" />,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" /></Icon>,
  Terminal: (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></Icon>,
  Edit: (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m14 6 4 4" /></Icon>,
  Read: (p) => <Icon {...p}><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H11v15H4.5A1.5 1.5 0 0 1 3 17.5v-12Z" /><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H13v15h6.5a1.5 1.5 0 0 0 1.5-1.5v-12Z" /></Icon>,
  Search2: (p) => <Icon {...p}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></Icon>,
  Check: (p) => <Icon {...p} d="m4 12 5 5L20 6" />,
  Dot: (p) => <Icon {...p} fill="currentColor" stroke="none"><circle cx="12" cy="12" r="5" /></Icon>,
  Copy: (p) => <Icon {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Icon>,
  Sidebar: (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Icon>,
  Sparkle: (p) => <Icon {...p} d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />,
  Cube: (p) => <Icon {...p}><path d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5Z" /><path d="M3 7l9 4.5L21 7M12 11.5V21.5" /></Icon>,
  Git: (p) => <Icon {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7M18 11.5c0 3-3 3.5-6 3.5" /></Icon>,
  Stop: (p) => <Icon {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" /></Icon>,
  X: (p) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />,
  Image: (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></Icon>,
  Brain: (p) => <Icon {...p}><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V15a3 3 0 0 0 4 2.8M9 4a2.5 2.5 0 0 1 3 0M9 4v13.8M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V15a3 3 0 0 1-4 2.8M15 4a2.5 2.5 0 0 0-3 0M15 4v13.8" /></Icon>,
};

Object.assign(window, { Icon, Icons });

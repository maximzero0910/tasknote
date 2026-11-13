const PATHS = {
  inbox: "M3 13l2.5-7h13L21 13v6H3zM3 13h5l1 3h6l1-3h5",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 7.500 4 7l-1 3 2 1v2l-2 1 1 3 2-.5L7.500 18l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.500-1.500 2 .5 1-3-2-1z",
  tag: "M3 12V4h8l10 10-8 8zM7.500 8.500h.01",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  x: "M6 6l12 12M18 6L6 18",
  check: "M5 12.500l4.500 4.500L19 7.500",
  down: "M6 9l6 6 6-6",
  up: "M6 15l6-6 6 6",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3",
  history: "M3 12a9 9 0 109-9 9 9 0 00-7 3.500M3 4v4h4M12 8v4l3 2",
  board: "M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z",
  list: "M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01",
  menu: "M4 6h16M4 12h16M4 18h16",
  archive: "M3 5h18v4H3zM5 9v10h14V9M10 13h4",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  download: "M12 4v11M7 11l5 5 5-5M4 20h16",
  upload: "M12 16V5M7 9l5-5 5 5M4 20h16",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  star: "M12 3l2.800 5.800 6.200.9-4.500 4.400 1.100 6.200L12 17.300 6.400 20.300l1.100-6.200L3 9.700l6.200-.9z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  folder: "M3 6h7l2 2h9v11H3z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

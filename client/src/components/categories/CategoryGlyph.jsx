/** Small original line glyphs for the eight wellness categories. */
export default function CategoryGlyph({ name = 'wave', className = 'h-6 w-6' }) {
  const paths = {
    wave: (
      <>
        <path d="M3 14c2.5 0 3.5-3 6-3s3.5 3 6 3 3.5-3 6-3" />
        <path d="M3 19c2.5 0 3.5-3 6-3s3.5 3 6 3 3.5-3 6-3" opacity="0.6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </>
    ),
    leaf: (
      <>
        <path d="M5 19c0-7 5-13 14-14 1 8-5 14-14 14Z" />
        <path d="M5 19c3-4 6-7 10-9" opacity="0.6" />
      </>
    ),
    stars: (
      <>
        <path d="M7 4l1.4 3.4L12 8.8l-3.6 1.4L7 13.6 5.6 10.2 2 8.8l3.6-1.4Z" />
        <path d="M16.5 13l1 2.4 2.5 1-2.5 1-1 2.4-1-2.4-2.5-1 2.5-1Z" opacity="0.75" />
      </>
    ),
    river: (
      <>
        <path d="M4 6c3 2 5-2 8 0s5-2 8 0" />
        <path d="M4 12c3 2 5-2 8 0s5-2 8 0" opacity="0.75" />
        <path d="M4 18c3 2 5-2 8 0s5-2 8 0" opacity="0.5" />
      </>
    ),
    lamp: (
      <>
        <path d="M8 20h8M12 20v-4" />
        <path d="M8 12a4 4 0 1 1 8 0c0 2-2 3-2 4h-4c0-1-2-2-2-4Z" />
        <path d="M12 5V2.5" opacity="0.6" />
      </>
    ),
    mountain: (
      <>
        <path d="M2 19l6-10 4 6 3-4 5 8H2Z" />
        <path d="M8 9l1.6 2.6" opacity="0.6" />
      </>
    ),
    moon: (
      <>
        <path d="M20 15.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 11.5Z" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name] || paths.wave}
    </svg>
  );
}

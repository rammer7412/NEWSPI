type Props = { className?: string };

/** NEWSPI's news-card and market-line symbol. */
export function NewspiMark({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <path d="M15 8h26l10 10v35a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="3.6" strokeLinejoin="round" />
      <path d="M41 8v10h10M19 22h17M19 29h12" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m19 46 9-8 7 4 11-12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="30" r="3" fill="currentColor" />
    </svg>
  );
}

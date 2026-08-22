/**
 * Ambient field behind every in-app page. Two fixed CSS layers, zero JS and
 * zero paint cost after first frame, so navigation feels continuous.
 */
export function PageBackdrop({ tone = "var(--accent)" }: { tone?: string }) {
  return (
    <>
      <div aria-hidden className="page-field" style={{ ["--tone" as string]: tone }} />
      <div aria-hidden className="page-grid" />
    </>
  );
}

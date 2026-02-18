/**
 * Minimal layout for TV / Room Display.
 * Uses Next-Gen design system (globals.css) – fullscreen-friendly for casting to a TV.
 */
export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: 'var(--background, #0a0a0f)',
        color: 'var(--text-primary, #f9fafb)',
      }}
    >
      {children}
    </div>
  );
}

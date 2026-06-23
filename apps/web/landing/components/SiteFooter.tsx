export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-6 py-8 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
      <span>Consentement implicite &agrave; l&apos;entr&eacute;e sur ce site.</span>
      <span>
        Built by{" "}
        <a
          href="https://lennygarnier.com"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-ink"
        >
          Lenny Garnier
        </a>
      </span>
    </footer>
  );
}

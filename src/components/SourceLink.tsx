interface SourceLinkProps {
  name: string | null | undefined;
  url: string | null | undefined;
  className?: string;
}

export function SourceLink({ name, url, className }: SourceLinkProps) {
  if (!url || !name) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `source-link ${className}` : 'source-link'}
    >
      {name} ↗
    </a>
  );
}

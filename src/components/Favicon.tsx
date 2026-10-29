import { faviconUrl } from '../lib/favicon';

// Hides itself if the icon can't load, instead of showing a broken-image box.
export function Favicon({ url, size = 32, className = 'favicon' }: { url: string; size?: number; className?: string }) {
  const src = faviconUrl(url, size);
  if (!src) return null;
  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

import { faviconUrl } from '../lib/favicon';

// Hides itself if the icon can't load, instead of showing a broken-image box.
export function Favicon({ url, size = 32, className = 'favicon' }: { url: string; size?: number; className?: string }) {
  return (
    <img
      className={className}
      src={faviconUrl(url, size)}
      alt=""
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

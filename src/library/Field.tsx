import { createContext, useContext, useEffect, useState } from 'react';

// The Colour field theme's room (docs/design/theme-colour-field.md, 5.1): five blurred fields of colour
// behind everything, lit by the library's freshest colours. Decoration only.

const SETTLE_MS = 1000;

// Each item's colour (lib/itemColor.ts), for its card's halo. Only provided in this theme.
export const ItemColorContext = createContext<Map<string, string> | undefined>(undefined);

export function useItemColor(id: string): string | undefined {
  return useContext(ItemColorContext)?.get(id);
}

export function Field({ colors }: { colors: string[] }) {
  // Changes settle for a second, so a burst of saves doesn't flicker the room.
  const key = colors.join(' ');
  const [shown, setShown] = useState(colors);
  useEffect(() => {
    const timer = setTimeout(() => setShown(key ? key.split(' ') : []), shown.length ? SETTLE_MS : 0);
    return () => clearTimeout(timer);
  }, [key]);
  if (!shown.length) return null;
  return (
    <div className="field-room" aria-hidden="true">
      {shown.map((color, i) => (
        <span key={i} className="field-light" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

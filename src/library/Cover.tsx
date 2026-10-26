import type { CSSProperties } from 'react';
import type { CoverSpec } from '../lib/covers';
import { formatDate } from '../lib/hooks';

// One cover in the Covers theme, drawn from a CoverSpec (src/lib/covers.ts) in HTML and CSS.
// All of it is decoration: the link around it carries the item's name, so the cover is aria-hidden.

const LANGUAGE_COLORS = ['#9DBB6A', '#7FA3DA', '#E09A72'];

interface Props {
  spec: CoverSpec;
  // A preview to show instead of the typeset cover ("Links show"), or the picture itself on a plate.
  imageUrl?: string;
  // The platform chip over a preview, as on Default cards.
  platformLabel?: string;
  plate?: number;
  // Notes show the date they were written.
  createdAt: number;
}

export function Cover({ spec, imageUrl, platformLabel, plate, createdAt }: Props) {
  if (imageUrl && spec.template !== 'picture') {
    return (
      <div className="cover cover--preview" aria-hidden="true">
        <img src={imageUrl} alt="" loading="lazy" />
        {platformLabel && <span className="card-platform">{platformLabel}</span>}
      </div>
    );
  }

  const style = spec.background ? ({ '--cover-bg': spec.background, '--cover-ink': spec.ink } as CSSProperties) : undefined;
  return (
    <div className={`cover cover--${spec.template}`} style={style} aria-hidden="true">
      {['article', 'post', 'repo'].includes(spec.template) && <span className="cover-spine" />}
      <div className="cover-fill">
        <CoverFace spec={spec} imageUrl={imageUrl} plate={plate} createdAt={createdAt} />
      </div>
    </div>
  );
}

function CoverFace({ spec, imageUrl, plate, createdAt }: Omit<Props, 'platformLabel'>) {
  switch (spec.template) {
    case 'article':
      return (
        <>
          <span className="cover-masthead">{spec.masthead}</span>
          <span className="cover-kicker">{spec.kicker}</span>
          <span className="cover-title">{spec.title}</span>
          {spec.dek && <span className="cover-dek">{spec.dek}</span>}
        </>
      );

    case 'video':
      return (
        <>
          <span className="cover-sprockets top" />
          <span className="cover-sprockets bottom" />
          <span className="cover-kicker">{spec.kicker}</span>
          <span className="cover-title">{spec.title}</span>
          {spec.duration && <span className="cover-duration">{spec.duration}</span>}
        </>
      );

    case 'post':
      return (
        <>
          <span className="cover-byline">
            <span>{spec.handle}</span>
            {spec.thread && <span>{spec.thread}</span>}
          </span>
          <span className="cover-lead">{spec.lead}</span>
          {spec.rest && <span className="cover-rest">{spec.rest}</span>}
          <span className="cover-footer">{spec.footer}</span>
        </>
      );

    case 'repo':
      return (
        <>
          <span className="cover-prompt">$ git clone</span>
          <span className="cover-repo">{spec.repoName}</span>
          {spec.dek && <span className="cover-dek">{spec.dek}</span>}
          <span className="cover-bottom">
            {spec.languages && (
              <span className="cover-languages">
                {spec.languages.map((language, i) => (
                  <span key={language} style={{ background: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length] }} />
                ))}
              </span>
            )}
            <span className="cover-path">{spec.repoPath}</span>
          </span>
        </>
      );

    case 'recipe':
      return (
        <span className="cover-menu">
          <span className="cover-host">{spec.host}</span>
          <span className="cover-title">{spec.title}</span>
          <svg width="64" height="10" viewBox="0 0 64 10">
            <path d="M0 5h26M38 5h26" stroke="currentColor" strokeWidth="1" />
            <path d="M32 1l4 4-4 4-4-4z" fill="currentColor" />
          </svg>
          {spec.recipeLine && <span className="cover-recipe-line">{spec.recipeLine}</span>}
        </span>
      );

    case 'dead':
      return (
        <>
          <span className="cover-host">{spec.host}</span>
          <span className="cover-title">{spec.title}</span>
          <span className="cover-stamp">Out of print</span>
        </>
      );

    case 'proof':
      return (
        <>
          <span className="cover-crop tl" />
          <span className="cover-crop tr" />
          <span className="cover-crop bl" />
          <span className="cover-crop br" />
          <span className="cover-proof">Proof</span>
          <span className="cover-host">{spec.host}</span>
        </>
      );

    case 'quote':
      return (
        <>
          <span className="cover-rule" style={{ background: spec.rule }} />
          <span className="cover-quote">{spec.title}</span>
          {spec.host && <span className="cover-from">from {spec.host}</span>}
        </>
      );

    case 'picture':
      return (
        <>
          {imageUrl ? (
            <img className="cover-plate" src={imageUrl} alt="" loading="lazy" />
          ) : (
            <span className="cover-plate cover-plate-missing">Plate missing</span>
          )}
          <span className="cover-caption">
            <span className="cover-caption-title">{spec.title}</span>
            {plate !== undefined && <span className="cover-plate-number">Plate {plate}</span>}
          </span>
        </>
      );

    case 'note':
      return (
        <>
          <span className="cover-note-head">
            <span>Your note</span>
            <span>{formatDate(createdAt)}</span>
          </span>
          <span className="cover-note">{spec.title}</span>
        </>
      );
  }
}

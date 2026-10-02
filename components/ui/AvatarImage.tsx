import React, { useState } from 'react';
import { getAvatarImageSrc } from '../../lib/avatars';

interface AvatarImageProps {
  src?: string | null;
  initials: string;
  imageClassName?: string;
  initialsClassName?: string;
  loading?: 'eager' | 'lazy';
}

/** Decorative image inside an already sized, positioned avatar tile. */
export const AvatarImage: React.FC<AvatarImageProps> = (props) => {
  const src = getAvatarImageSrc(props.src);
  // A source change starts a new load lifecycle, including after an image error.
  return <AvatarImageContent key={src ?? 'empty'} {...props} src={src} />;
};

const AvatarImageContent: React.FC<AvatarImageProps> = ({
  src,
  initials,
  imageClassName = '',
  initialsClassName = '',
  loading = 'lazy',
}) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  return (
    <span className="absolute inset-0" aria-hidden="true" data-avatar-state={src ? state : 'empty'}>
      {state !== 'loaded' && (
        <span className={`absolute inset-0 flex items-center justify-center ${initialsClassName}`}>
          {initials}
        </span>
      )}
      {src && state !== 'error' && (
        <img
          src={src}
          alt=""
          width={64}
          height={64}
          loading={loading}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-contain ${imageClassName}`}
          style={{ opacity: state === 'loaded' ? 1 : 0 }}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
    </span>
  );
};

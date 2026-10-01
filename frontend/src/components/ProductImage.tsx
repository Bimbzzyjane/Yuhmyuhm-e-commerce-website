'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * Product imagery with a guaranteed graceful failure.
 *
 * Catalogue images are bundled locally under `public/images/catalog/`, but a
 * product can still have no `src` at all (e.g. `stainless-piping-tip-set-24`,
 * whose only candidate photo had an unverifiable licence). Rather than showing
 * the browser's broken-image glyph, we swap in the branded local placeholder —
 * the layout never shifts and the storefront never looks broken.
 *
 * Renders with `fill`, so the parent element must be positioned (all callers
 * use a `.product-card__media` / `.cart-line__media` wrapper, which are).
 */
export interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  className,
  sizes = '(max-width: 720px) 100vw, 25vw',
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const useFallback = failed || !src;

  return (
    <Image
      src={useFallback ? '/images/placeholder.svg' : (src as string)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
      // Local placeholders are already tiny; skipping the optimizer avoids a
      // needless round trip and any chance of an optimizer error.
      unoptimized={useFallback}
    />
  );
}

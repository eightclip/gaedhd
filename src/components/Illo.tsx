/* eslint-disable @next/next/no-img-element */
// Thin wrapper for the hand-drawn illustration PNGs. Plain <img> on purpose:
// the art has varied aspect ratios, so callers set a height and let width auto.
export function Illo({ src, alt = '', className = '' }: { src: string; alt?: string; className?: string }) {
  return <img src={src} alt={alt} className={className} draggable={false} />
}

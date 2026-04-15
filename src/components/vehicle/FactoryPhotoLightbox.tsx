import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, BookOpen, ExternalLink, Trash2 } from 'lucide-react';

interface PhotoLightboxImage {
  url: string;
  title?: string;
  sourceUrl?: string;
  isUserPhoto?: boolean;
}

interface FactoryPhotoLightboxProps {
  images: PhotoLightboxImage[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (index: number) => void;
}

export default function FactoryPhotoLightbox({ images, initialIndex = 0, onClose, onDelete }: FactoryPhotoLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const img = images[idx];

  const goNext = useCallback(() => setIdx(i => Math.min(i + 1, images.length - 1)), [images.length]);
  const goPrev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev]);

  if (!img) return null;

  const isCharm = !img.isUserPhoto;
  const attribution = isCharm
    ? 'Source: Operation CHARM (charm.li) — Factory Service Manual'
    : `Photo ${idx + 1} of ${images.length}`;

  const content = (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.95)' }}
      onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isCharm && <BookOpen className="h-4 w-4 text-primary" />}
          <span className="text-xs text-muted-foreground">
            {img.title || (isCharm ? `Factory Diagram ${idx + 1} of ${images.length}` : `Step Photo ${idx + 1} of ${images.length}`)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {img.isUserPhoto && onDelete && (
            <button onClick={() => onDelete(idx)}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-destructive/20 transition-colors">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
          {img.sourceUrl && isCharm && (
            <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline">
              charm.li <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <img
          src={img.url}
          alt={img.title || 'Photo'}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Navigation */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={goPrev} disabled={idx === 0}
            className="h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-20"
            style={{ background: '#1a1a1a' }}>
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-sm text-muted-foreground font-mono">{idx + 1} / {images.length}</span>
          <button onClick={goNext} disabled={idx === images.length - 1}
            className="h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-20"
            style={{ background: '#1a1a1a' }}>
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>
      )}

      {/* Attribution */}
      <div className="text-center pb-4 shrink-0">
        <span className="text-[11px] text-muted-foreground">{attribution}</span>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

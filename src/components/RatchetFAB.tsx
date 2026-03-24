import { useAppStore } from '@/stores/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useRef, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ratchet-fab-position';
const HINT_KEY = 'ratchet-fab-drag-hint-seen';
const EDGE_MARGIN = 24;
const CLAMP_TOP = 80;
const CLAMP_BOTTOM = 80;
const BUTTON_SIZE = 64;
const DRAG_THRESHOLD = 8;

interface DockedPosition {
  edge: 'left' | 'right';
  verticalPercent: number;
}

function loadPosition(): DockedPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePosition(pos: DockedPosition) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
}

function getPixelPosition(pos: DockedPosition) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const y = Math.min(
    Math.max(pos.verticalPercent * vh, CLAMP_TOP),
    vh - CLAMP_BOTTOM - BUTTON_SIZE
  );
  const x = pos.edge === 'left' ? EDGE_MARGIN : vw - BUTTON_SIZE - EDGE_MARGIN;
  return { x, y };
}

function WrenchChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-4 4v-4H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="currentColor"
        opacity="0.25"
      />
      <path
        d="M18.5 6.5a3.5 3.5 0 0 0-3.23 2.15l-5.42 5.42a3.5 3.5 0 1 0 1.58 1.58l5.42-5.42A3.5 3.5 0 1 0 18.5 6.5zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9.5 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RatchetFAB() {
  const { isRatchetOpen, openRatchetPanel, ratchetProjectContext } = useAppStore();
  const isMobile = useIsMobile();

  const defaultPos: DockedPosition = { edge: 'right', verticalPercent: isMobile ? 0.78 : 0.85 };
  const [docked, setDocked] = useState<DockedPosition>(() => loadPosition() || defaultPos);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const mouseDownTime = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isInProject = !!ratchetProjectContext;

  const updateFromDocked = useCallback((d: DockedPosition) => {
    setPos(getPixelPosition(d));
  }, []);

  useEffect(() => {
    const saved = loadPosition();
    const d = saved || defaultPos;
    setDocked(d);
    updateFromDocked(d);
    setMounted(true);

    const onResize = () => updateFromDocked(loadPosition() || defaultPos);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobile]);

  useEffect(() => {
    if (localStorage.getItem(HINT_KEY)) return;
    const t = setTimeout(() => {
      setShowHint(true);
      const t2 = setTimeout(() => {
        setShowHint(false);
        localStorage.setItem(HINT_KEY, 'true');
      }, 3000);
      return () => clearTimeout(t2);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - BUTTON_SIZE));
      const newY = Math.max(CLAMP_TOP, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - CLAMP_BOTTOM - BUTTON_SIZE));
      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setDragging(false);
      const centerX = e.clientX;
      const edge: 'left' | 'right' = centerX < window.innerWidth / 2 ? 'left' : 'right';
      const clampedY = Math.max(CLAMP_TOP, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - CLAMP_BOTTOM - BUTTON_SIZE));
      const verticalPercent = clampedY / window.innerHeight;
      const newDocked: DockedPosition = { edge, verticalPercent };
      setDocked(newDocked);
      savePosition(newDocked);
      setPos(getPixelPosition(newDocked));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const t = e.touches[0];
      const newX = Math.max(0, Math.min(t.clientX - dragOffset.current.x, window.innerWidth - BUTTON_SIZE));
      const newY = Math.max(CLAMP_TOP, Math.min(t.clientY - dragOffset.current.y, window.innerHeight - CLAMP_BOTTOM - BUTTON_SIZE));
      setPos({ x: newX, y: newY });
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setDragging(false);
      const t = e.changedTouches[0];
      const edge: 'left' | 'right' = t.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const clampedY = Math.max(CLAMP_TOP, Math.min(t.clientY - dragOffset.current.y, window.innerHeight - CLAMP_BOTTOM - BUTTON_SIZE));
      const newDocked: DockedPosition = { edge, verticalPercent: clampedY / window.innerHeight };
      setDocked(newDocked);
      savePosition(newDocked);
      setPos(getPixelPosition(newDocked));
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const hasMoved = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownTime.current = Date.now();
    hasMoved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    isDragging.current = true;
    setDragging(true);
    setTooltipOpen(false);
    if (showHint) {
      setShowHint(false);
      localStorage.setItem(HINT_KEY, 'true');
    }
  };

  // Track if mouse actually moved a meaningful distance (drag vs tap)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startPos.current.x;
      const dy = t.clientY - startPos.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouchMove);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('touchmove', onTouchMove); };
  }, []);

  const handleClick = () => {
    if (!hasMoved.current) {
      openRatchetPanel();
    }
  };

  if (isRatchetOpen || !mounted) return null;

  const tooltipText = isInProject ? 'Ask Ratchet about this repair' : 'Ask Ratchet anything';

  const button = (
    <button
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={cn(
        'group fixed z-[9999] flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg select-none',
        dragging
          ? 'scale-110 cursor-grabbing'
          : 'transition-all duration-200 ease-out hover:scale-105 cursor-pointer',
        'h-16 w-16'
      )}
      style={{
        left: pos.x,
        top: pos.y,
        boxShadow: dragging
          ? '0 8px 32px rgba(249,115,22,0.5)'
          : '0 4px 24px rgba(249,115,22,0.35)',
        ...(dragging ? {} : { transition: 'left 0.2s ease-out, top 0.2s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out' }),
      }}
      aria-label={tooltipText}
    >
      <span className="absolute inset-0 rounded-full animate-ratchet-pulse bg-primary/40" />
      <WrenchChatIcon className="h-7 w-7 relative z-10" />
      {/* Project indicator dot */}
      {isInProject && (
        <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-primary z-20" />
      )}
    </button>
  );

  return (
    <>
      {isMobile || dragging ? (
        button
      ) : (
        <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side={docked.edge === 'right' ? 'left' : 'right'} className="bg-popover text-popover-foreground border-border">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      )}
      {showHint && (
        <div
          className="fixed z-[9998] text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-1.5 animate-fade-in pointer-events-none"
          style={{
            left: docked.edge === 'right' ? pos.x - 80 : pos.x + BUTTON_SIZE + 8,
            top: pos.y + BUTTON_SIZE + 8,
          }}
        >
          Hold to move me
        </div>
      )}
    </>
  );
}

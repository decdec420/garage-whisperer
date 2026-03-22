import { useAppStore } from '@/stores/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function WrenchChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Speech bubble */}
      <path
        d="M6 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-4 4v-4H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="currentColor"
        opacity="0.25"
      />
      {/* Wrench */}
      <path
        d="M18.5 6.5a3.5 3.5 0 0 0-3.23 2.15l-5.42 5.42a3.5 3.5 0 1 0 1.58 1.58l5.42-5.42A3.5 3.5 0 1 0 18.5 6.5zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9.5 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RatchetFAB() {
  const { isRatchetOpen, openRatchetPanel } = useAppStore();
  const isMobile = useIsMobile();

  if (isRatchetOpen) return null;

  const button = (
    <button
      onClick={() => openRatchetPanel()}
      className={cn(
        'group fixed z-[9999] flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-150 active:scale-95',
        'h-16 w-16 hover:scale-110',
        isMobile ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-6' : 'bottom-6 right-6'
      )}
      style={{
        boxShadow: '0 4px 24px rgba(249,115,22,0.35)',
      }}
      aria-label="Ask Ratchet"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full animate-ratchet-pulse bg-primary/40" />
      <WrenchChatIcon className="h-7 w-7 relative z-10" />
    </button>
  );

  if (isMobile) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="left" className="bg-popover text-popover-foreground border-border">
        Ask Ratchet
      </TooltipContent>
    </Tooltip>
  );
}

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ratchetIcon from '@/assets/ratchet-icon.png';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export default function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md hover:bg-primary/10 transition-all"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        <img
          src={ratchetIcon}
          alt=""
          className={cn(
            'h-5 w-5 transition-transform duration-300 ease-in-out',
            show ? 'rotate-90' : 'rotate-0'
          )}
        />
      </button>
    </div>
  );
}

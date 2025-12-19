import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const palette = ['bg-indigo-500', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-500', 'bg-sky-600', 'bg-violet-500'];

function colorFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs',
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

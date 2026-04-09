import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

// 700-level fills keep white initials above 4.5:1 contrast.
const palette = ['bg-indigo-600', 'bg-emerald-700', 'bg-amber-700', 'bg-rose-700', 'bg-sky-700', 'bg-violet-700'];

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

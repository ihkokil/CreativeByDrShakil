'use client';

interface FloatingTagProps {
  label: string;
  title: string;
}

export default function FloatingTag({ label, title }: FloatingTagProps) {
  return (
    <div className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/90 text-xs font-medium tracking-wide pointer-events-none select-none shadow-lg border border-white/10">
      {label} &middot; {title}
    </div>
  );
}



import React, { useState } from 'react';
import { Footprints } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center p-4 text-center border border-zinc-200">
        <Footprints className="w-8 h-8 text-zinc-400 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-zinc-500 line-clamp-2 max-w-[180px]">
          {fallbackLabel || alt || "RYAN'S SHOES COLLECTION"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

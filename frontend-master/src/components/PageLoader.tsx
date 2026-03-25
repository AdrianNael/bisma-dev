import React from "react";
import Image, { ImageLoaderProps } from "next/image";

interface PageLoaderProps {
  className?: string;
}

// Custom loader for local static images (required by next.config.js custom loader setting)
const localLoader = ({ src }: ImageLoaderProps) => src;

const PageLoader: React.FC<PageLoaderProps> = ({ className = "" }) => {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white bg-opacity-80 backdrop-blur-sm ${className}`}
    >
      <div className="relative w-32 h-32 md:w-48 md:h-48">
        <Image
          src="/loading-uper.gif"
          alt="Loading..."
          fill
          className="object-contain"
          style={{ mixBlendMode: "multiply" }}
          loader={localLoader}
          unoptimized
        />
      </div>
    </div>
  );
};

export default PageLoader;

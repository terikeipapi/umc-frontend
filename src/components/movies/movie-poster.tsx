import type { ImgHTMLAttributes } from "react";

const posterPlaceholder = "/images/poster-placeholder.svg";

interface MoviePosterProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  src: string;
  alt: string;
}

export default function MoviePoster({ src, alt, onError, ...props }: MoviePosterProps) {
  return (
    <img
      {...props}
      src={src || posterPlaceholder}
      alt={alt}
      onError={(event) => {
        if (event.currentTarget.getAttribute("src") !== posterPlaceholder) {
          event.currentTarget.src = posterPlaceholder;
        }
        onError?.(event);
      }}
    />
  );
}

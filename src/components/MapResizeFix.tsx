import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const fix = () => {
      map.invalidateSize();
    };

    const timer = window.setTimeout(fix, 0);

    window.addEventListener("resize", fix);
    window.addEventListener("orientationchange", fix);
    window.visualViewport?.addEventListener("resize", fix);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", fix);
      window.removeEventListener("orientationchange", fix);
      window.visualViewport?.removeEventListener("resize", fix);
    };
  }, [map]);

  return null;
}

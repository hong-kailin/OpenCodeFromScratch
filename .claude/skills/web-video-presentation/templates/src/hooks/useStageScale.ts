import { useEffect, useState } from "react";

/**
 * Compute the scale needed to fit a 1920x1080 stage inside the current
 * viewport.
 *
 * `marginX` / `marginY` default to 0 — the stage is meant to FILL the
 * screen so a fullscreen (F11) recording at a 16:9 display needs no
 * cropping in post. On a 1920×1080 viewport this yields scale === 1 and
 * the stage maps 1:1 to physical pixels.
 *
 * The progress bar deliberately does NOT get its own margin here: it is
 * fixed chrome that OVERLAYS the top edge of the stage (see ProgressBar.css).
 * Reserving margin for it would letterbox every recording — the exact thing
 * a full-bleed stage is for. Chapters keep the top --stage-pad-y clear of
 * content, which is what the bar sits in.
 */
export function useStageScale(
  baseW = 1920,
  baseH = 1080,
  marginX = 0,
  marginY = 0,
) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      const usefulW = Math.max(320, window.innerWidth - marginX * 2);
      const usefulH = Math.max(180, window.innerHeight - marginY * 2);
      setScale(Math.min(usefulW / baseW, usefulH / baseH));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [baseW, baseH, marginX, marginY]);

  return scale;
}

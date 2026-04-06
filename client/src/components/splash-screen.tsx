import { useEffect, useState } from "react";
import logoImage from "@assets/Lumirra Logo Design (original)_1761875532047.png";
import { useTheme } from "@/components/theme-provider";

// Bump this string whenever the splash animation changes — forces all users
// to see the updated full-branded splash on their next app open.
export const SPLASH_ANIMATION_VERSION = "fb-dots-v7";

interface SplashScreenProps {
  onDone: () => void;
  minimal?: boolean;
}

export function SplashScreen({ onDone, minimal = false }: SplashScreenProps) {
  const [fading, setFading] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Theme-aware colors
  const bg          = isDark ? "hsl(222,85%,6%)"       : "hsl(218,60%,97%)";
  const dotIdle     = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.13)";
  const dotActive   = isDark ? "hsl(210,100%,56%)"     : "hsl(210,100%,44%)";
  const logoShadow  = isDark
    ? "drop-shadow(0 6px 22px rgba(255,255,255,0.28))"
    : "drop-shadow(0 6px 18px rgba(0,0,0,0.28))";

  useEffect(() => {
    const duration = minimal ? 700 : 1600;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, duration);

    const doneTimer = setTimeout(() => {
      onDone();
    }, duration + 400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone, minimal]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        transition: "opacity 0.4s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          animation: "splash-enter 0.55s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <img
          src={logoImage}
          alt="Lumirra"
          style={{
            width: minimal ? 56 : 76,
            height: minimal ? 56 : 76,
            objectFit: "contain",
            filter: logoShadow,
          }}
        />

        <DotsRow cycleSeconds={1.4} dotIdle={dotIdle} dotActive={dotActive} />
      </div>

      <style>{`
        @keyframes splash-enter {
          from { opacity: 0; transform: scale(0.86); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fb-dot {
          0%, 55%, 100% {
            transform: scale(0.7);
            background: ${dotIdle};
          }
          27% {
            transform: scale(1.25);
            background: ${dotActive};
          }
        }
      `}</style>
    </div>
  );
}

function DotsRow({
  count = 5,
  cycleSeconds = 1.4,
  dotIdle,
  dotActive: _dotActive,
}: {
  count?: number;
  cycleSeconds?: number;
  dotIdle: string;
  dotActive: string;
}) {
  const step = cycleSeconds / count;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: dotIdle,
            animation: `fb-dot ${cycleSeconds}s ease-in-out ${(i * step).toFixed(2)}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

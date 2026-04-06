import { Wallet, ChartCandlestick, Repeat } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";

interface Ripple {
  id: number;
  index: number;
}

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation('common');
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [counter, setCounter] = useState(0);

  const navItems = [
    { nameKey: "bottomNav.wallet",  icon: Wallet,           path: "/dashboard", testId: "nav-wallet" },
    { nameKey: "bottomNav.market",  icon: ChartCandlestick, path: "/market",    testId: "nav-market" },
    { nameKey: "bottomNav.swap",    icon: Repeat,           path: "/swap",      testId: "nav-swap"   },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") return location === "/" || location === "/dashboard";
    return location.startsWith(path);
  };

  const handleNav = useCallback((path: string, index: number) => {
    const id = counter + 1;
    setCounter(id);
    setRipples((prev) => [...prev, { id, index }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 650);
    setLocation(path);
  }, [counter, setLocation]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 48px)",
        maxWidth: "380px",
        zIndex: 40,
      }}
    >
      <div className="glass-nav px-2 py-1.5">
        <LayoutGroup id="bottom-nav">
          <div className="flex items-center justify-around">
            {navItems.map((item, index) => {
              const active = isActive(item.path);
              const Icon = item.icon;

              return (
                <motion.button
                  key={item.nameKey}
                  onClick={() => handleNav(item.path, index)}
                  className="flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 relative select-none"
                  data-testid={item.testId}
                  whileTap={{ scale: 0.90 }}
                  transition={{ type: "spring", stiffness: 450, damping: 22 }}
                  style={{ WebkitTapHighlightColor: "transparent", minWidth: "72px" }}
                >
                  {/* Water blob — fills tab area, animates between tabs */}
                  {active && (
                    <motion.div
                      layoutId="nav-water-blob"
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(ellipse at 50% 45%, rgba(22,119,255,0.30) 0%, rgba(22,119,255,0.12) 60%, transparent 100%)",
                        border: "1px solid rgba(22,119,255,0.30)",
                        originX: 0.5,
                        originY: 0.5,
                      }}
                      animate={{
                        borderRadius: [
                          "999px",
                          "40% 60% 55% 45% / 50% 45% 55% 50%",
                          "55% 45% 40% 60% / 45% 55% 50% 50%",
                          "48% 52% 52% 48% / 52% 48% 48% 52%",
                          "999px",
                        ],
                        scaleX:   [1, 1.10, 0.95, 1.03, 1],
                        scaleY:   [1, 0.82, 1.10, 0.97, 1],
                        opacity:  [1, 0.80, 0.95, 1.00, 1],
                        boxShadow: [
                          "0 0 8px rgba(22,119,255,0.16) inset,  0 0 3px rgba(22,119,255,0.08)",
                          "0 0 20px rgba(22,119,255,0.38) inset, 0 0 10px rgba(22,119,255,0.22)",
                          "0 0 12px rgba(22,119,255,0.22) inset, 0 0 5px rgba(22,119,255,0.12)",
                          "0 0 8px rgba(22,119,255,0.16) inset,  0 0 3px rgba(22,119,255,0.08)",
                          "0 0 8px rgba(22,119,255,0.16) inset,  0 0 3px rgba(22,119,255,0.08)",
                        ],
                      }}
                      transition={{
                        layout: {
                          type: "spring",
                          stiffness: 40,
                          damping: 8,
                          mass: 1.8,
                        },
                        borderRadius: { duration: 0.65, ease: "easeInOut",           times: [0, 0.28, 0.58, 0.78, 1] },
                        scaleX:       { duration: 0.65, ease: [0.34, 1.2, 0.64, 1], times: [0, 0.28, 0.58, 0.78, 1] },
                        scaleY:       { duration: 0.65, ease: [0.34, 1.2, 0.64, 1], times: [0, 0.28, 0.58, 0.78, 1] },
                        opacity:      { duration: 0.65, ease: "easeInOut",           times: [0, 0.28, 0.58, 0.78, 1] },
                        boxShadow:    { duration: 0.65, ease: "easeInOut",           times: [0, 0.28, 0.58, 0.78, 1] },
                      }}
                    />
                  )}

                  {/* Touch ripple burst */}
                  <AnimatePresence>
                    {ripples
                      .filter((r) => r.index === index)
                      .map((r) => (
                        <motion.span
                          key={r.id}
                          className="absolute rounded-full pointer-events-none"
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            left: "0",
                            top: "50%",
                            translateY: "-50%",
                            background:
                              "radial-gradient(circle, rgba(22,119,255,0.40) 0%, rgba(22,119,255,0.00) 70%)",
                          }}
                          initial={{ scale: 0.3, opacity: 0.85 }}
                          animate={{ scale: 2.0, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ))}
                  </AnimatePresence>

                  <Icon
                    className={`h-5 w-5 relative z-10 transition-colors duration-300 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span
                    className={`text-xs font-medium relative z-10 transition-colors duration-300 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {t(item.nameKey)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}

import { Wallet, ChartCandlestick, Repeat } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation('common');

  const navItems = [
    {
      nameKey: "bottomNav.wallet",
      icon: Wallet,
      path: "/dashboard",
      testId: "nav-wallet",
    },
    {
      nameKey: "bottomNav.market",
      icon: ChartCandlestick,
      path: "/market",
      testId: "nav-market",
    },
    {
      nameKey: "bottomNav.swap",
      icon: Repeat,
      path: "/swap",
      testId: "nav-swap",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location === "/" || location === "/dashboard";
    }
    return location.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-2xl mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <button
              key={item.nameKey}
              onClick={() => setLocation(item.path)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
              data-testid={item.testId}
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                strokeWidth={active ? 3 : 2.5}
              />
              <span
                className={`text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {t(item.nameKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

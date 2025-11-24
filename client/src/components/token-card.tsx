import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface TokenCardProps {
  symbol: string;
  name: string;
  balance: string;
  fiatValue: string;
  currencySymbol?: string;
  icon?: string;
  price?: string;
  priceChange?: string;
  chainSymbol?: string;
  chainIcon?: string;
  chainId?: string;
  onClick?: () => void;
}

export function TokenCard({
  symbol,
  name,
  balance,
  fiatValue,
  currencySymbol = "$",
  icon,
  price,
  priceChange = "+0.00",
  chainSymbol,
  chainIcon,
  chainId,
  onClick
}: TokenCardProps) {
  const isPositive = priceChange.startsWith("+") || parseFloat(priceChange) >= 0;
  const [tokenIconError, setTokenIconError] = useState(false);
  const [chainIconError, setChainIconError] = useState(false);
  
  // Hide chain badge for native tokens (token symbol matches chain symbol)
  const isNativeToken = symbol === chainSymbol;
  
  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all" 
      onClick={onClick}
      data-testid={chainId ? `card-token-${symbol.toLowerCase()}-${chainId}` : `card-token-${symbol.toLowerCase()}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
              <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-white/10">
                {icon && !tokenIconError ? (
                  <img 
                    src={icon} 
                    alt={symbol} 
                    className="w-full h-full object-cover" 
                    onError={() => setTokenIconError(true)}
                    loading="lazy"
                  />
                ) : (
                  <span className="text-primary font-bold text-xs sm:text-sm">{symbol[0]}</span>
                )}
              </div>
              {chainIcon && !isNativeToken && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
                  {!chainIconError ? (
                    <img 
                      src={chainIcon} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      onError={() => setChainIconError(true)}
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[8px] sm:text-[9px] font-medium">{symbol[0]}</span>
                  )}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm sm:text-base text-foreground truncate">{symbol}</p>
                {chainSymbol && (
                  <span className="text-xs text-muted-foreground">({chainSymbol})</span>
                )}
              </div>
              {price && (
                <div className="flex items-center gap-1.5">
                  <p className="text-xs sm:text-sm font-medium text-foreground">${price}</p>
                  <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                    {isPositive && parseFloat(priceChange) > 0 ? '+' : ''}{priceChange}%
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-semibold text-sm sm:text-base text-foreground">{balance}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{currencySymbol}{fiatValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  testId?: string;
}

export function QuickActionButton({ icon, label, onClick, testId }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all text-white"
    >
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs sm:text-sm font-medium text-white">{label}</span>
    </button>
  );
}

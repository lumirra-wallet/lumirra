import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search, Plus, ArrowUp, GripVertical } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/contexts/wallet-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ManageCoins() {
  const [, setLocation] = useLocation();
  const { walletId, isAuthenticated, isLoading } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Fetch ALL tokens (including hidden ones) for manage-coins page
  const { data: allTokensData } = useQuery({
    queryKey: ["/api/wallet", walletId, "all-tokens"],
    enabled: !!walletId,
  });

  // Fetch available chains for chain badges
  const { data: chainsData } = useQuery({
    queryKey: ["/api/chains"],
  });

  // Fetch real-time prices for sorting by market cap
  const { data: pricesData } = useQuery({
    queryKey: ["/api/prices"],
    enabled: !!walletId,
  });

  const chains = (chainsData as any) || [];
  const tokens = (allTokensData as any)?.tokens || [];

  // Filter tokens based on search
  const searchFilteredTokens = tokens.filter((token: any) =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.contractAddress?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort tokens by market cap (popularity) - most popular tokens first
  const filteredTokens = [...searchFilteredTokens].sort((a: any, b: any) => {
    const aCoingeckoId = a.coingeckoId || a.symbol.toLowerCase();
    const bCoingeckoId = b.coingeckoId || b.symbol.toLowerCase();
    const aMarketCap = (pricesData as any)?.[aCoingeckoId]?.usd_market_cap || 0;
    const bMarketCap = (pricesData as any)?.[bCoingeckoId]?.usd_market_cap || 0;
    return bMarketCap - aMarketCap; // Highest market cap first
  });

  const removeTokenMutation = useMutation({
    mutationFn: async (tokenSymbol: string) => {
      const response = await fetch(`/api/wallet/${walletId}/tokens/${tokenSymbol}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove token");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", walletId, "all-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", walletId, "portfolio"] });
      toast({
        title: "Token removed",
        description: "Token has been removed from your wallet",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ tokenId, isVisible }: { tokenId: string; isVisible: boolean }) => {
      const response = await fetch(`/api/wallet/${walletId}/tokens/${tokenId}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to update token visibility");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", walletId, "all-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", walletId, "portfolio"] });
      toast({
        title: "Token visibility updated",
        description: "Your changes have been saved",
      });
    },
  });

  if (!isAuthenticated || !walletId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
              className="hover-elevate"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-display font-semibold">Manage Coins</h1>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl">
        {/* Search and Add */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter token name or token contract address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-tokens"
            />
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setLocation("/add-custom-token")}
            data-testid="button-add-token"
            className="shrink-0"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Token List */}
        <div className="space-y-2">
          {filteredTokens.map((token: any) => (
            <Card
              key={token.id}
              className="p-3 hover-elevate cursor-pointer"
              data-testid={`card-token-${token.symbol.toLowerCase()}-${token.chainId}`}
              onClick={() => setLocation(`/token/${token.symbol.toLowerCase()}/${token.chainId}`)}
            >
              <div className="flex items-center gap-3">
                {/* Token Icon with Chain Badge */}
                <div className="relative w-10 h-10 flex-shrink-0">
                  <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-white/10">
                    {token.icon && !imageErrors[`token-${token.id}`] ? (
                      <img 
                        src={token.icon} 
                        alt={token.name} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => {
                          setImageErrors(prev => ({ ...prev, [`token-${token.id}`]: true }));
                        }}
                      />
                    ) : (
                      <span className="text-primary font-bold text-sm">{token.symbol[0]}</span>
                    )}
                  </div>
                  {/* Chain Badge */}
                  {(() => {
                    const chain = chains.find((c: any) => c.id === token.chainId);
                    const isNativeToken = token.symbol === chain?.symbol;
                    return chain?.icon && !isNativeToken ? (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
                        {!imageErrors[`chain-${chain.id}`] ? (
                          <img 
                            src={chain.icon} 
                            alt="" 
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [`chain-${chain.id}`]: true }));
                            }}
                          />
                        ) : (
                          <span className="text-[8px] font-medium">{token.symbol[0]}</span>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {token.symbol}
                    {(() => {
                      const chain = chains.find((c: any) => c.id === token.chainId);
                      return chain?.symbol ? (
                        <span className="text-sm text-muted-foreground ml-1.5">
                          ({chain.symbol})
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {token.name}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover-elevate"
                    onClick={() => setLocation(`/send-list/${token.walletId}`)}
                    data-testid={`button-pin-${token.symbol.toLowerCase()}-${token.chainId}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover-elevate"
                    onClick={() => setLocation(`/receive-qr/${token.id}`)}
                    data-testid={`button-qr-${token.symbol.toLowerCase()}-${token.chainId}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={token.isVisible !== false}
                    onCheckedChange={(checked) => {
                      toggleVisibilityMutation.mutate({ tokenId: token.id, isVisible: checked });
                    }}
                    data-testid={`switch-${token.symbol.toLowerCase()}-${token.chainId}`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredTokens.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tokens found</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { QrScanner } from "@/components/qr-scanner";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { ArrowLeft, QrCode, AlertCircle, Clipboard } from "lucide-react";
import { useLocation, useParams } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWallet } from "@/contexts/wallet-context";
import { formatBalance } from "@/lib/format-balance";

export default function Send() {
  const { tokenId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { walletId, isAuthenticated, isLoading } = useWallet();
  
  const [recipient, setRecipient] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [showInsufficientGasDialog, setShowInsufficientGasDialog] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingSuccessMessage, setPendingSuccessMessage] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Check for scanned address from QR scanner
  useEffect(() => {
    const scannedAddress = localStorage.getItem('scannedAddress');
    if (scannedAddress) {
      setRecipient(scannedAddress);
      localStorage.removeItem('scannedAddress'); // Clear after use
      toast({
        title: "Address Applied",
        description: "QR code address has been filled in",
      });
    }
  }, [toast]);

  // Use all-tokens endpoint to include hidden tokens (users should be able to send any token they own)
  const { data: allTokensData } = useQuery({
    queryKey: ["/api/wallet", walletId, "all-tokens"],
    enabled: !!walletId,
  });

  const { data: chainsData } = useQuery({
    queryKey: ["/api/chains"],
  });

  // Fetch real-time prices
  const { data: pricesData } = useQuery({
    queryKey: ["/api/prices"],
    enabled: !!walletId,
    refetchInterval: 60000,
  });

  // Fetch user data to check send permission
  const { data: userData } = useQuery<any>({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated && !!walletId,
  });

  const chains = (chainsData as any) || [];
  const allTokens = (allTokensData as any)?.tokens || [];
  
  // Find the selected token by ID (MongoDB returns _id, not id)
  const token = allTokens.find((t: any) => t._id === tokenId || t.id === tokenId);
  const chain = chains.find((c: any) => c.id === token?.chainId);

  // Get real-time price
  const coingeckoId = token?.coingeckoId || token?.symbol?.toLowerCase();
  const priceInfo = (pricesData as any)?.[coingeckoId];
  const currentPrice = priceInfo?.usd || 0;

  // Get wallet address for this chain
  const walletAddress = chain?.address || "";

  // Native token (for gas) on this chain
  const nativeToken = allTokens.find((t: any) => 
    t.chainId === token?.chainId && 
    t.symbol?.toUpperCase() === chain?.symbol?.toUpperCase()
  );

  // Fetch transaction fee for the token being sent (with fallback to native token)
  const { data: feeData } = useQuery({
    queryKey: ["/api/fees", token?.symbol, token?.chainId, nativeToken?.symbol],
    enabled: !!token?.symbol && !!token?.chainId,
    queryFn: async () => {
      const response = await fetch(
        `/api/fees/${token.symbol}?chainId=${token.chainId}&nativeTokenSymbol=${nativeToken?.symbol || ''}`, 
        {
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error("Failed to fetch fee");
      return response.json();
    },
  });

  // Get gas token balance and required fee
  const gasBalance = parseFloat(nativeToken?.balance || "0");
  const gasRequired = parseFloat(feeData?.feeAmount || "0.001");

  

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/wallet/${walletId}/send`, {
        to: recipient,
        amount: cryptoAmount,
        tokenSymbol: token.symbol,
        chainId: token.chainId,
        memo,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send transaction");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowConfirmDialog(false);
      setIsProcessing(true);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", walletId] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", walletId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setPendingSuccessMessage("Your transaction has been broadcast to the network.");
    },
    onError: (error: Error) => {
      setShowConfirmDialog(false);
      setPendingSuccessMessage(null);
      toast({
        variant: "destructive",
        title: "Transaction failed",
        description: error.message,
      });
    },
  });

  const handleProcessingComplete = () => {
    setIsProcessing(false);
    if (pendingSuccessMessage) {
      toast({
        title: "Transaction sent",
        description: pendingSuccessMessage,
      });
      setPendingSuccessMessage(null);
      setTimeout(() => {
        setLocation("/dashboard");
      }, 1000);
    }
  };

  // Handle crypto amount change
  const handleCryptoAmountChange = (value: string) => {
    setCryptoAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && currentPrice > 0) {
      setUsdAmount((numValue * currentPrice).toFixed(2));
    } else {
      setUsdAmount("");
    }
  };

  // Handle USD amount change
  const handleUsdAmountChange = (value: string) => {
    setUsdAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && currentPrice > 0) {
      const cryptoValue = numValue / currentPrice;
      setCryptoAmount(cryptoValue.toFixed(6).replace(/\.?0+$/, ''));
    } else {
      setCryptoAmount("");
    }
  };

  // Set max amount
  const handleMaxClick = () => {
    const balance = parseFloat(token?.balance || "0");
    setCryptoAmount(balance.toString());
    setUsdAmount((balance * currentPrice).toFixed(2));
  };

  // Validate address based on chain
  const validateAddress = (address: string, chainSymbol: string): boolean => {
    if (!address) return true; // Don't show error for empty address
    
    const upperSymbol = chainSymbol.toUpperCase();
    
    // Ethereum and BNB (EVM chains) - 0x followed by 40 hex characters
    if (upperSymbol === 'ETH' || upperSymbol === 'BNB') {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    // TRON - T followed by 33 alphanumeric characters
    if (upperSymbol === 'TRX') {
      return /^T[a-zA-Z0-9]{33}$/.test(address);
    }
    
    // Solana - 32-44 base58 characters
    if (upperSymbol === 'SOL') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
    
    return true; // Default to valid for unknown chains
  };

  // Handle recipient change with validation
  const handleRecipientChange = (value: string) => {
    setRecipient(value);
    const chainSymbol = chain?.symbol || '';
    if (value && !validateAddress(value, chainSymbol)) {
      setAddressError("Invalid address");
    } else {
      setAddressError("");
    }
  };

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRecipient(text);
      const chainSymbol = chain?.symbol || '';
      if (text && !validateAddress(text, chainSymbol)) {
        setAddressError("Invalid address");
      } else {
        setAddressError("");
      }
      toast({
        title: "Address pasted",
        description: "Recipient address has been pasted from clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Paste failed",
        description: "Unable to paste from clipboard.",
      });
    }
  };

  // Handle QR scan result
  const handleQrScan = (decodedText: string) => {
    setRecipient(decodedText);
    setShowQrScanner(false);
    const chainSymbol = chain?.symbol || '';
    if (decodedText && !validateAddress(decodedText, chainSymbol)) {
      setAddressError("Invalid address");
    } else {
      setAddressError("");
    }
    toast({
      title: "Address scanned",
      description: "QR code has been scanned successfully.",
    });
  };

  // Handle next button - show confirmation dialog
  const handleSend = () => {
    console.log("🔥 NEXT BUTTON CLICKED!");
    console.log("Recipient:", recipient);
    console.log("Amount:", cryptoAmount);
    console.log("Address Error:", addressError);
    
    // Validate address first
    if (addressError || !recipient) {
      console.log("❌ Validation failed: Invalid address");
      toast({
        variant: "destructive",
        title: "Invalid address",
        description: "Please enter a valid recipient address.",
      });
      return;
    }

    // Validate inputs
    if (!cryptoAmount || parseFloat(cryptoAmount) <= 0) {
      console.log("❌ Validation failed: Invalid amount");
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: "Please enter an amount to send.",
      });
      return;
    }

    // Check if amount exceeds token balance
    const tokenBalance = parseFloat(token?.balance || "0");
    const amountToSend = parseFloat(cryptoAmount);
    if (amountToSend > tokenBalance) {
      console.log("❌ Validation failed: Insufficient balance");
      toast({
        variant: "destructive",
        title: "Insufficient Amount",
        description: `You don't have enough ${token.symbol}. Available: ${formatBalance(tokenBalance)}`,
      });
      return;
    }

    // Check if user has permission to send crypto
    const canSendCrypto = userData?.canSendCrypto ?? false;
    if (!canSendCrypto) {
      console.log("🚫 User does not have permission to send crypto");
      setShowInsufficientGasDialog(true);
      toast({
        variant: "destructive",
        title: "Insufficient fee",
        description: "You need to have sufficient fee to complete this transaction.",
      });
      return;
    }

    // Check if we have enough gas
    console.log("Gas balance:", gasBalance, "Gas required:", gasRequired);
    if (gasBalance < gasRequired) {
      console.log("⛽ Insufficient gas, showing dialog");
      console.log("showInsufficientGasDialog state before:", showInsufficientGasDialog);
      setShowInsufficientGasDialog(true);
      console.log("showInsufficientGasDialog state after:", showInsufficientGasDialog);
      
      // Also show a toast as backup
      toast({
        variant: "destructive",
        title: "Insufficient gas",
        description: `You need ${gasRequired} ${nativeToken?.symbol} for transaction fees. Current balance: ${gasBalance}`,
      });
      return;
    }

    // Show confirmation dialog
    console.log("✅ Showing confirmation dialog");
    setShowConfirmDialog(true);
  };

  // Actually send the transaction (called from confirmation dialog)
  const confirmSend = () => {
    setShowConfirmDialog(false);
    sendMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Token not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                data-testid="button-back"
                className="hover-elevate"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-display font-semibold">Send</h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-2xl">
        {/* Token Selector */}
        <div
          className="flex items-center justify-between p-3 rounded-lg bg-card border cursor-pointer hover-elevate mb-4"
          onClick={() => setLocation(`/send-list/${walletId}`)}
          data-testid="button-select-token"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
              <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-muted">
                {token.icon ? (
                  <img
                    src={token.icon}
                    alt={token.symbol}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-primary font-bold">{token.symbol[0]}</span>
                )}
              </div>
              {chain?.icon && token.symbol?.toUpperCase() !== chain.symbol?.toUpperCase() && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
                  <img src={chain.icon} alt={chain.name} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold">{token.symbol}</div>
              <div className="text-sm text-muted-foreground">{chain?.name}</div>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
        </div>

        {/* Recipient Address */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">To</label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover-elevate"
                onClick={handlePaste}
                data-testid="button-paste"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover-elevate"
                onClick={() => setShowQrScanner(true)}
                data-testid="button-scan-qr"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Input
              placeholder="Enter the address"
              value={recipient}
              onChange={(e) => handleRecipientChange(e.target.value)}
              className={`font-mono text-sm ${addressError ? 'border-destructive' : ''}`}
              data-testid="input-recipient"
            />
          </div>
          {addressError && (
            <p className="text-xs text-destructive mt-1">{addressError}</p>
          )}
          {!addressError && (
            <Alert className="mt-2 bg-muted/50 border-muted">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Please ensure that the receiving address supports the{" "}
                <span className="font-semibold">{token.symbol}</span> network.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Amount */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Amount</label>
          </div>
          
          {/* Crypto Amount */}
          <div className="relative mb-3">
            <Input
              type="number"
              placeholder="0.00"
              value={cryptoAmount}
              onChange={(e) => handleCryptoAmountChange(e.target.value)}
              className="pr-24 text-lg"
              data-testid="input-amount-crypto"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-semibold hover:bg-primary/10"
                onClick={handleMaxClick}
                data-testid="button-max"
              >
                MAX
              </Button>
              <span className="text-sm font-medium">{token.symbol}</span>
            </div>
          </div>

          {/* USD Amount */}
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              value={usdAmount}
              onChange={(e) => handleUsdAmountChange(e.target.value)}
              className="pr-16 text-lg"
              data-testid="input-amount-usd"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium">
              USD
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Available balance:{" "}
            <span className="text-primary font-medium" data-testid="text-available-balance">
              {formatBalance(parseFloat(token.balance || "0"))} {token.symbol}
            </span>
          </p>
        </div>

        {/* Memo */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">MEMO</label>
          <Textarea
            placeholder="Optional"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="resize-none min-h-[80px]"
            data-testid="input-memo"
          />
        </div>

        {/* Send Button */}
        <Button
          className="w-full h-12 text-base font-semibold relative z-50"
          onClick={(e) => {
            console.log("🎯 BUTTON CLICK EVENT FIRED!");
            e.preventDefault();
            e.stopPropagation();
            handleSend();
          }}
          disabled={sendMutation.isPending}
          data-testid="button-send"
          style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
        >
          {sendMutation.isPending ? "Sending..." : "Next"}
        </Button>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={showQrScanner} onOpenChange={setShowQrScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {showQrScanner && (
              <QrScanner
                onScan={handleQrScan}
                onError={(error) => {
                  toast({
                    variant: "destructive",
                    title: "Scanner error",
                    description: error,
                  });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Insufficient Gas Dialog */}
      <Dialog open={showInsufficientGasDialog} onOpenChange={setShowInsufficientGasDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insufficient Gas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <p className="text-sm">
              You need more {nativeToken?.symbol || chain?.symbol || 'gas'} to pay the network fee.
            </p>

            <div className="bg-muted rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gas Required:</span>
                <span className="font-semibold">
                  {gasRequired} {nativeToken?.symbol || chain?.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your Balance:</span>
                <span className="font-semibold">
                  {formatBalance(gasBalance)} {nativeToken?.symbol || chain?.symbol}
                </span>
              </div>
            </div>

            {nativeToken && (
              <div
                className="flex items-center justify-between p-3 rounded-lg bg-card border cursor-pointer hover-elevate"
                onClick={() => {
                  setShowInsufficientGasDialog(false);
                  setLocation(`/receive-qr/${nativeToken._id || nativeToken.id}`);
                }}
                data-testid="button-gas-station"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <span className="text-2xl">⛽</span>
                  </div>
                  <div>
                    <div className="font-semibold">Gas Station</div>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
              </div>
            )}
          </div>
          </DialogContent>
        </Dialog>

      {/* Send Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send</DialogTitle>
            </DialogHeader>
            {token && chain && nativeToken ? (
            <div className="space-y-4 p-4">
              {/* Token Display */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div className="relative w-10 h-10">
                  <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-background">
                    {token.icon ? (
                      <img src={token.icon} alt={token.symbol} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-bold">{token.symbol[0]}</span>
                    )}
                  </div>
                  {chain?.icon && token.symbol?.toUpperCase() !== chain.symbol?.toUpperCase() && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border flex items-center justify-center overflow-hidden">
                      <img src={chain.icon} alt={chain.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-lg">{cryptoAmount} {token.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    {chain?.networkStandard} {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                  </div>
                </div>
              </div>

              {/* From/To */}
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">From</span>
                  <span className="font-mono text-xs">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-mono text-xs text-primary">{recipient.slice(0, 8)}...{recipient.slice(-6)}</span>
                </div>
              </div>

              {/* Network Fee */}
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="font-semibold">
                    {gasRequired} {nativeToken.symbol} ({chain?.networkStandard})
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background">
                  <span className="text-sm">Pay with</span>
                  <div className="flex items-center gap-2">
                    {nativeToken.icon && (
                      <img src={nativeToken.icon} alt={nativeToken.symbol} className="w-5 h-5 rounded-full" />
                    )}
                    <span className="text-sm font-medium">{nativeToken.symbol}({chain?.networkStandard})</span>
                  </div>
                </div>
                <div className="text-xs text-right text-muted-foreground">
                  {nativeToken.symbol} Balance: {formatBalance(parseFloat(nativeToken.balance))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={sendMutation.isPending}
                  data-testid="button-cancel-send"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmSend}
                  disabled={sendMutation.isPending}
                  data-testid="button-confirm-send"
                >
                  {sendMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
            ) : (
              <div className="p-4">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

      {/* Processing Overlay */}
      <ProcessingOverlay
        isProcessing={isProcessing}
        onComplete={handleProcessingComplete}
        message="Processing transaction..."
      />
    </div>
  );
}

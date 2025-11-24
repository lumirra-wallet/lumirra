import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { safeStorage } from "@/lib/safe-storage";
import i18n from "@/i18n";

interface WalletContextType {
  walletId: string | null;
  walletAddress: string | null;
  setWallet: (id: string, address: string) => void;
  clearWallet: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verify authentication with backend
    const verifyAuth = async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });
        
        if (response.ok) {
          const userData = await response.json();
          
          // Apply user preferences from database
          if (userData.language) {
            const currentLanguage = i18n.language || 'en';
            if (userData.language !== currentLanguage) {
              i18n.changeLanguage(userData.language);
              safeStorage.setItem("language", userData.language);
            }
          }
          
          if (userData.fiatCurrency) {
            const currentFiatCurrency = safeStorage.getItem("fiatCurrency");
            if (currentFiatCurrency !== userData.fiatCurrency) {
              safeStorage.setItem("fiatCurrency", userData.fiatCurrency);
              // Trigger a storage event with proper key/newValue
              const storageEvent = new StorageEvent('storage', {
                key: 'fiatCurrency',
                newValue: userData.fiatCurrency,
                oldValue: currentFiatCurrency,
                storageArea: localStorage,
              });
              window.dispatchEvent(storageEvent);
            }
          }
          
          // If backend returns wallet data, use it
          if (userData.wallet) {
            const walletIdFromApi = userData.wallet.id || userData.wallet._id;
            const walletAddressFromApi = userData.wallet.address;
            
            if (walletIdFromApi && walletAddressFromApi) {
              setWalletId(walletIdFromApi);
              setWalletAddress(walletAddressFromApi);
              safeStorage.setItem("wallet-id", walletIdFromApi);
              safeStorage.setItem("wallet-address", walletAddressFromApi);
            }
          } else {
            // Session valid but no wallet from API - check localStorage
            const savedWalletId = safeStorage.getItem("wallet-id");
            const savedWalletAddress = safeStorage.getItem("wallet-address");
            
            if (savedWalletId && savedWalletAddress) {
              setWalletId(savedWalletId);
              setWalletAddress(savedWalletAddress);
            }
          }
        } else if (response.status === 401 || response.status === 403) {
          // Authentication failed - clear everything including preferences
          setWalletId(null);
          setWalletAddress(null);
          safeStorage.removeItem("wallet-id");
          safeStorage.removeItem("wallet-address");
          safeStorage.removeItem("language");
          safeStorage.removeItem("fiatCurrency");
          
          // Reset i18n to default language to prevent cross-user leakage
          i18n.changeLanguage('en');
        }
      } catch (error) {
        console.error("Auth verification error:", error);
        // Network error - try to use saved data if available
        const savedWalletId = safeStorage.getItem("wallet-id");
        const savedWalletAddress = safeStorage.getItem("wallet-address");
        
        if (savedWalletId && savedWalletAddress) {
          setWalletId(savedWalletId);
          setWalletAddress(savedWalletAddress);
        }
      }
      
      setIsLoading(false);
    };

    verifyAuth();
  }, []);

  const setWallet = (id: string, address: string) => {
    setWalletId(id);
    setWalletAddress(address);
    safeStorage.setItem("wallet-id", id);
    safeStorage.setItem("wallet-address", address);
  };

  const clearWallet = () => {
    setWalletId(null);
    setWalletAddress(null);
    safeStorage.removeItem("wallet-id");
    safeStorage.removeItem("wallet-address");
  };

  return (
    <WalletContext.Provider
      value={{
        walletId,
        walletAddress,
        setWallet,
        clearWallet,
        isAuthenticated: walletId !== null,
        isLoading,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/wallet-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { languageCodeToName } from "@/i18n";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { clearWallet, isAuthenticated, isLoading } = useWallet();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation('common');
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);
  
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  
  // Load from localStorage
  const [selectedCurrency, setSelectedCurrency] = useState(() => 
    localStorage.getItem("fiatCurrency") || "USD"
  );
  
  // Get current language from i18n and convert to display name
  const currentLanguageCode = i18n.language || 'en';
  const selectedLanguage = languageCodeToName[currentLanguageCode] || "English";

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearWallet();
      toast({
        title: t('settings.loggedOut'),
        description: t('settings.loggedOutDescription'),
      });
      setLocation("/");
    }
  };

  const handleClearCache = () => {
    // Clear TanStack Query cache
    queryClient.clear();
    
    // Clear localStorage except for important settings
    const preserve = ["fiatCurrency", "transactionCost", "theme", "i18nextLng"];
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !preserve.includes(key)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach(key => localStorage.removeItem(key));
    
    toast({
      title: t('settings.cacheCleared'),
      description: t('settings.cacheDescription'),
    });
  };


  const getThemeDisplay = () => {
    if (theme === "dark") return t('settings.darkMode');
    return t('settings.lightMode');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
              className="mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold flex-1 text-center mr-10">{t('settings.title')}</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-2xl">
        {/* First Group - Security & Cache */}
        <div className="bg-card rounded-xl mb-4">
          <button
            onClick={() => setLocation("/settings/security")}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-t-xl border-b border-border"
            data-testid="button-security"
          >
            <span className="text-foreground">{t('settings.security')}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          
          <button
            onClick={handleClearCache}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-b-xl"
            data-testid="button-clear-cache"
          >
            <span className="text-foreground">{t('settings.clearCache')}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Second Group - Preferences */}
        <div className="bg-card rounded-xl mb-4">
          <button
            onClick={() => setAppearanceOpen(true)}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-t-xl border-b border-border"
            data-testid="button-appearance"
          >
            <span className="text-foreground">{t('settings.appearance')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{getThemeDisplay()}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
          
          <button
            onClick={() => setLocation("/settings/currency")}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 border-b border-border"
            data-testid="button-fiat-currency"
          >
            <span className="text-foreground">{t('settings.fiatCurrency')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$ {selectedCurrency}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
          
          <button
            onClick={() => setLocation("/settings/language")}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-b-xl"
            data-testid="button-language"
          >
            <span className="text-foreground">{t('settings.language')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedLanguage}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Third Group - Help & Info */}
        <div className="bg-card rounded-xl mb-4">
          <button
            onClick={() => setLocation("/faq")}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-t-xl border-b border-border"
            data-testid="button-help-center"
          >
            <span className="text-foreground">{t('settings.helpCenter')}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          
          <button
            onClick={() => setLocation("/contact")}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 border-b border-border"
            data-testid="button-support"
          >
            <span className="text-foreground">{t('settings.support')}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          
          <button
            onClick={() => setLocation("/settings/about")}
            className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-b-xl"
            data-testid="button-about"
          >
            <span className="text-foreground">{t('settings.about')}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-sm text-muted-foreground">V4.9.2</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('settings.logOut')}
        </Button>
      </div>

      {/* Appearance Dialog */}
      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-appearance">
          <DialogHeader>
            <DialogTitle>{t('settings.appearance')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => {
                setTheme("dark");
                setAppearanceOpen(false);
              }}
              className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="option-dark-mode"
            >
              <span className="text-foreground">{t('settings.darkMode')}</span>
              {theme === "dark" && <Check className="h-5 w-5 text-primary" />}
            </button>
            
            <button
              onClick={() => {
                setTheme("light");
                setAppearanceOpen(false);
              }}
              className="w-full flex items-center justify-between p-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="option-light-mode"
            >
              <span className="text-foreground">{t('settings.lightMode')}</span>
              {theme === "light" && <Check className="h-5 w-5 text-primary" />}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

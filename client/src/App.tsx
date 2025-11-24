import React, { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/contexts/wallet-context";
import { ChainProvider } from "@/contexts/chain-context";
import { cacheManager } from "@/lib/cache-manager";
import { safeStorage } from "@/lib/safe-storage";
import { WebSocketProvider } from "@/lib/websocket";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import CreateAccount from "@/pages/create-account";
import Login from "@/pages/login";
import Recovery from "@/pages/recovery";
import Welcome from "@/pages/welcome";
import CreateWallet from "@/pages/create-wallet";
import ImportWallet from "@/pages/import-wallet";
import Dashboard from "@/pages/dashboard";
import TokenDetail from "@/pages/token-detail";
import SendList from "@/pages/send-list";
import Send from "@/pages/send";
import Receive from "@/pages/receive";
import ReceiveQr from "@/pages/receive-qr";
import Swap from "@/pages/swap";
import SwapOrders from "@/pages/swap-orders";
import SwapOrderDetails from "@/pages/swap-order-details";
import Settings from "@/pages/settings";
import SettingsSecurity from "@/pages/settings-security";
import SettingsSecurityChangePassword from "@/pages/settings-security-change-password";
import SettingsCurrency from "@/pages/settings-currency";
import SettingsLanguage from "@/pages/settings-language";
import SettingsAbout from "@/pages/settings-about";
import Feedback from "@/pages/feedback";
import TermsOfUse from "@/pages/terms-of-use";
import History from "@/pages/history";
import Notifications from "@/pages/notifications";
import QRScanner from "@/pages/qr-scanner";
import TransactionDetail from "@/pages/transaction-detail";
import ManageCoins from "@/pages/manage-coins";
import AddCustomToken from "@/pages/add-custom-token";
import BuySell from "@/pages/buy-sell";
import AddressBook from "@/pages/address-book";
import Market from "@/pages/market";
import NewsDetail from "@/pages/news-detail";
import FAQ from "@/pages/faq";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import SwapsInfo from "@/pages/swaps-info";
import BuyCryptoInfo from "@/pages/buy-crypto-info";
import Profile from "@/pages/profile";
import EditProfile from "@/pages/edit-profile";
import ViewProfileDetails from "@/pages/view-profile-details";
import ConnectedDapps from "@/pages/connected-dapps";
import SupportChat from "@/pages/support-chat";
import PriceAlerts from "@/pages/price-alerts";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminLogin from "@/pages/admin-login";

function ConditionalProviders() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={AdminDashboard} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <WalletProvider>
      <ChainProvider>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/create-account" component={CreateAccount} />
          <Route path="/login" component={Login} />
          <Route path="/recovery" component={Recovery} />
          <Route path="/welcome" component={Welcome} />
          <Route path="/create-wallet" component={CreateWallet} />
          <Route path="/import-wallet" component={ImportWallet} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/qr-scanner" component={QRScanner} />
          <Route path="/profile" component={Profile} />
          <Route path="/profile/edit" component={EditProfile} />
          <Route path="/profile/view-details" component={ViewProfileDetails} />
          <Route path="/profile/connected-dapps" component={ConnectedDapps} />
          <Route path="/support-chat" component={SupportChat} />
          <Route path="/price-alerts" component={PriceAlerts} />
          <Route path="/market" component={Market} />
          <Route path="/news/:id" component={NewsDetail} />
          <Route path="/token/:symbol/:chainId" component={TokenDetail} />
          <Route path="/token/:symbol" component={TokenDetail} />
          <Route path="/send/:tokenId" component={Send} />
          <Route path="/send" component={SendList} />
          <Route path="/receive" component={Receive} />
          <Route path="/receive-qr/:tokenId" component={ReceiveQr} />
          <Route path="/swap" component={Swap} />
          <Route path="/swap/orders/:orderId" component={SwapOrderDetails} />
          <Route path="/swap/orders" component={SwapOrders} />
          <Route path="/buy-sell" component={BuySell} />
          <Route path="/settings" component={Settings} />
          <Route path="/settings/currency" component={SettingsCurrency} />
          <Route path="/settings/language" component={SettingsLanguage} />
          <Route path="/settings/security/change-password" component={SettingsSecurityChangePassword} />
          <Route path="/settings/security" component={SettingsSecurity} />
          <Route path="/settings/about" component={SettingsAbout} />
          <Route path="/feedback" component={Feedback} />
          <Route path="/terms-of-use" component={TermsOfUse} />
          <Route path="/history" component={History} />
          <Route path="/transaction/:hash" component={TransactionDetail} />
          <Route path="/manage-coins" component={ManageCoins} />
          <Route path="/add-custom-token" component={AddCustomToken} />
          <Route path="/address-book" component={AddressBook} />
          <Route path="/faq" component={FAQ} />
          <Route path="/about" component={About} />
          <Route path="/contact" component={Contact} />
          <Route path="/swaps-info" component={SwapsInfo} />
          <Route path="/buy-crypto-info" component={BuyCryptoInfo} />
          <Route component={NotFound} />
        </Switch>
      </ChainProvider>
    </WalletProvider>
  );
}

function App() {
  useEffect(() => {
    try {
      cacheManager.autoCheck();
      
      const healthCheck = safeStorage.runHealthCheck();
      if (!healthCheck.healthy) {
        console.warn('Storage health check failed:', healthCheck.issues);
        if (healthCheck.issues.length > 5) {
          console.warn('Multiple storage issues detected, running auto-cleanup');
          safeStorage.autoCleanup();
        }
      }

      safeStorage.autoCleanup();

      const storageInfo = safeStorage.getStorageInfo();
      console.log('Storage Info:', storageInfo);
    } catch (error) {
      console.error('Startup cache check failed:', error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <ConditionalProviders />
          </TooltipProvider>
        </ThemeProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
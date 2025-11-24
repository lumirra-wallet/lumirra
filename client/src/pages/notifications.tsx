import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ArrowUpRight, ArrowDownLeft, Headphones } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/contexts/wallet-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";

type NotificationTab = "ALL" | "Transaction" | "System" | "News";

interface MarketNews {
  _id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  importance: "low" | "medium" | "high" | "critical";
  category?: string;
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { walletId, isAuthenticated, isLoading: isAuthLoading } = useWallet();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<NotificationTab>("ALL");

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthLoading, isAuthenticated, setLocation]);

  // Fetch notifications with real-time updates
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?walletId=${walletId}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!walletId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  const notifications: Notification[] = notificationsData || [];
  // Filter out support chat notifications from display (they appear in support chat page instead)
  const nonSupportChatNotifications = notifications.filter(n => !n.metadata?.supportChat);
  const filteredNotifications = activeTab === "ALL" 
    ? nonSupportChatNotifications 
    : nonSupportChatNotifications.filter(n => n.category === activeTab);

  // Fetch market news
  const { data: newsData, isLoading: isNewsLoading } = useQuery<MarketNews[]>({
    queryKey: ["/api/market-news"],
    enabled: activeTab === "News",
  });

  const marketNews: MarketNews[] = newsData || [];

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/notifications/mark-all-read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId }),
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "Marked as read",
        description: "All notifications have been marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    },
  });

  // Clear all notifications mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/notifications/clear`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId }),
      });
      if (!response.ok) throw new Error("Failed to clear notifications");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "Cleared",
        description: "All notifications have been cleared",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear notifications",
        variant: "destructive",
      });
    },
  });

  // Mark single notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification._id);
    }

    // Navigate to support chat if it's a support chat notification
    if (notification.metadata?.supportChat) {
      setLocation("/support-chat");
      return;
    }

    // Navigate to swap order details if it's a swap notification with orderId
    if (notification.metadata?.orderId) {
      setLocation(`/swap/orders/${notification.metadata.orderId}`);
      return;
    }

    // Navigate to transaction details if it's a transaction notification
    if (notification.transactionId && notification.transactionId.hash) {
      setLocation(`/transaction/${notification.transactionId.hash}`);
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-background border-b z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-back"
                className="hover-elevate active-elevate-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold" data-testid="text-notifications-title">
                Notifications
              </h1>
            </div>
            {filteredNotifications.some(n => !n.isRead) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                data-testid="button-read-all"
                className="text-primary hover:text-primary/80"
              >
                {markAllAsReadMutation.isPending ? "Marking..." : "Read All"}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-8 mt-4 border-b">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`pb-3 relative ${
                activeTab === "ALL"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-all"
            >
              ALL
              {activeTab === "ALL" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("Transaction")}
              className={`pb-3 relative ${
                activeTab === "Transaction"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-transaction"
            >
              Transaction
              {activeTab === "Transaction" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("System")}
              className={`pb-3 relative ${
                activeTab === "System"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-system"
            >
              System
              {activeTab === "System" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("News")}
              className={`pb-3 relative ${
                activeTab === "News"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-news"
            >
              Market News
              {activeTab === "News" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Container */}
      <div className="container mx-auto px-4 py-4">
        {/* Notifications List */}
        {activeTab === "News" ? (
          <div className="space-y-3">
            {isNewsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Loading market news...</p>
              </div>
            ) : marketNews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No market news available</p>
              </div>
            ) : (
              marketNews.map((news) => (
                <a
                  key={news._id}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg hover-elevate active-elevate-2 border"
                  data-testid={`news-${news._id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm" data-testid={`text-news-title-${news._id}`}>
                          {news.title}
                        </h3>
                        {news.importance === "critical" && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-destructive text-destructive-foreground">
                            Critical
                          </span>
                        )}
                        {news.importance === "high" && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-500 text-white">
                            High
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {news.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{news.source}</span>
                        <span>•</span>
                        <span>{new Date(news.publishedAt).toLocaleDateString()}</span>
                        {news.category && (
                          <>
                            <span>•</span>
                            <span>{news.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        ) : (
        <div className="space-y-1">
          {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No {activeTab.toLowerCase()} notifications</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
              <button
                key={notification._id}
                className="w-full text-left p-4 rounded-lg hover-elevate active-elevate-2 flex items-start gap-3 relative"
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-${notification._id}`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary">
                  {notification.metadata?.supportChat ? (
                    <Headphones className="h-5 w-5 text-white" data-testid={`icon-headphones-${notification._id}`} />
                  ) : notification.type === "sent" ? (
                    <ArrowUpRight className="h-5 w-5 text-white" data-testid={`icon-sent-${notification._id}`} />
                  ) : (
                    <ArrowDownLeft className="h-5 w-5 text-white" data-testid={`icon-received-${notification._id}`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-sm sm:text-base ${!notification.isRead ? 'font-bold' : ''}`}>
                      {notification.title}
                    </h3>
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" data-testid={`unread-indicator-${notification._id}`}></span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    {notification.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTimestamp(notification.timestamp)}</span>
                    <span>{notification.metadata?.walletAddress || ""}</span>
                  </div>
                </div>

                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 -rotate-90" />
              </button>
            ))
          )}
        </div>
        )}
      </div>
    </div>
  );
}

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { queryClient } from "./queryClient";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastMessage: null,
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const connect = () => {
    // Only connect in browser
    if (typeof window === 'undefined') return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('WebSocket message received:', message);
          setLastMessage(message);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.log('Max reconnect attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connection established:', message);
        break;

      case 'balance_updated':
        // Invalidate wallet/token queries to fetch fresh data
        console.log('Balance updated for user:', message.userId);
        queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
        queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
        break;

      case 'notification_created':
        // Invalidate notifications query to show new notification
        console.log('New notification for user:', message.userId);
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        break;

      case 'transaction_created':
      case 'transaction_updated':
        // Invalidate transaction and balance queries for all consumers
        console.log('Transaction event:', message.type, 'for wallet:', message.walletId);
        queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
        queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
        break;

      case 'swap_order_updated':
        // Invalidate swap order queries
        console.log('Swap order updated:', message.orderId);
        queryClient.invalidateQueries({ queryKey: ['/api/swap-orders'] });
        if (message.orderId) {
          queryClient.invalidateQueries({ queryKey: ['/api/swap-orders', message.orderId] });
        }
        break;

      case 'fee_updated':
        // Invalidate fee queries
        console.log('Fee updated:', message.tokenSymbol);
        queryClient.invalidateQueries({ queryKey: ['/api/fees', message.tokenSymbol] });
        queryClient.invalidateQueries({ queryKey: ['/api/fees'] });
        break;

      case 'user_fees_updated':
        // Invalidate user-specific fee queries
        console.log('User fees updated for:', message.userId);
        queryClient.invalidateQueries({ queryKey: ['/api/admin/user-fees'] });
        break;

      case 'support_chat_message':
        // New support chat message received
        console.log('Support chat message received');
        queryClient.invalidateQueries({ queryKey: ['/api/support-chat'] });
        break;

      case 'support_chat_unread_update':
        // Real-time unread count update for chat bubble and dashboard headset icon
        console.log('Support chat unread count updated:', message.unreadCount);
        
        // Update unread count query data
        queryClient.setQueryData(['/api/support-chat/unread-count'], { unreadCount: message.unreadCount });
        
        // Try to update cached full chat data first
        const updated = queryClient.setQueryData(['/api/support-chat'], (old: any) => {
          if (old) {
            return { ...old, unreadUserCount: message.unreadCount };
          }
          return old;
        });
        
        // If no cached data exists, invalidate to trigger fetch
        if (!updated) {
          console.log('No cached support chat data, triggering fetch');
          queryClient.invalidateQueries({ queryKey: ['/api/support-chat'] });
        }
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  };

  useEffect(() => {
    // Only connect if we have a session (check for session cookie)
    // This prevents constant reconnection attempts before login
    const checkAuthAndConnect = async () => {
      try {
        // Quick check to see if we have an active session
        const response = await fetch('/api/user', { 
          credentials: 'include',
          method: 'GET',
        });
        
        if (response.ok) {
          // User is authenticated, connect WebSocket
          connect();
        } else {
          console.log('WebSocket: Waiting for authentication');
        }
      } catch (error) {
        console.log('WebSocket: Auth check failed, not connecting');
      }
    };

    checkAuthAndConnect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

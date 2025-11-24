import { MarketNews, PriceAlert, Notification, Wallet, UserPushSubscription } from "../models";
import { getSimplePrices } from "./coingecko";

// CryptoPanic API configuration (free tier)
const CRYPTOPANIC_API_URL = "https://cryptopanic.com/api/v1/posts/";
const CRYPTOPANIC_API_KEY = process.env.CRYPTOPANIC_API_KEY || "demo"; // Use 'demo' for testing

// Symbol to CoinGecko ID mapping for common cryptocurrencies
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  bnb: "binancecoin",
  usdt: "tether",
  usdc: "usd-coin",
  xrp: "ripple",
  ada: "cardano",
  doge: "dogecoin",
  sol: "solana",
  trx: "tron",
  dot: "polkadot",
  matic: "matic-network",
  ltc: "litecoin",
  shib: "shiba-inu",
  avax: "avalanche-2",
  uni: "uniswap",
  link: "chainlink",
  atom: "cosmos",
  etc: "ethereum-classic",
  xlm: "stellar",
  bch: "bitcoin-cash",
  algo: "algorand",
  vet: "vechain",
  fil: "filecoin",
  apt: "aptos",
};

// Sanitize HTML to prevent XSS attacks
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

// Map news importance based on votes/kind
function determineImportance(votes: any): "low" | "medium" | "high" | "critical" {
  const positiveVotes = votes?.positive || 0;
  const negativeVotes = votes?.negative || 0;
  const totalVotes = positiveVotes + negativeVotes;

  if (totalVotes > 100) return "critical";
  if (totalVotes > 50) return "high";
  if (totalVotes > 10) return "medium";
  return "low";
}

// Fetch crypto news from CryptoPanic API
export async function fetchCryptoNews(): Promise<void> {
  try {
    console.log("[Background Job] Fetching crypto news...");
    
    const response = await fetch(
      `${CRYPTOPANIC_API_URL}?auth_token=${CRYPTOPANIC_API_KEY}&public=true&filter=hot`
    );

    if (!response.ok) {
      console.error("[Background Job] CryptoPanic API error:", response.statusText);
      return;
    }

    const data = await response.json();
    const posts = data.results || [];

    let newCount = 0;
    for (const post of posts.slice(0, 20)) { // Process top 20 hot news
      try {
        // Check if news already exists
        const exists = await MarketNews.findOne({ externalId: post.id.toString() });
        if (exists) continue;

        // Create news entry
        const news = new MarketNews({
          externalId: post.id.toString(),
          title: sanitizeHtml(post.title || "Breaking Crypto News"),
          description: sanitizeHtml(post.title || ""),
          url: post.url || "",
          source: post.source?.title || "CryptoPanic",
          imageUrl: post.source?.favicon || null,
          publishedAt: new Date(post.published_at),
          category: post.currencies?.length > 0 ? post.currencies[0].code : "General",
          importance: determineImportance(post.votes),
        });

        await news.save();
        newCount++;

        // Create notifications for high/critical importance news
        if (news.importance === "high" || news.importance === "critical") {
          await createNewsNotifications(news);
        }
      } catch (err) {
        console.error("[Background Job] Error saving news item:", err);
      }
    }

    console.log(`[Background Job] Fetched ${newCount} new crypto news items`);
  } catch (error) {
    console.error("[Background Job] Error fetching crypto news:", error);
  }
}

// Create notifications for all users about important news
async function createNewsNotifications(news: any): Promise<void> {
  try {
    // Get all wallets
    const wallets = await Wallet.find({}).select("_id");

    const notifications = wallets.map((wallet) => ({
      walletId: wallet._id,
      category: "System",
      type: "system",
      title: `${news.importance === "critical" ? "BREAKING" : "Important"} Crypto News`,
      description: news.title,
      metadata: {
        newsId: news._id,
        url: news.url,
        source: news.source,
        importance: news.importance,
      },
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`[Background Job] Created ${notifications.length} news notifications`);
    }
  } catch (error) {
    console.error("[Background Job] Error creating news notifications:", error);
  }
}

// Check price alerts and trigger notifications
export async function checkPriceAlerts(): Promise<void> {
  try {
    console.log("[Background Job] Checking price alerts...");

    // Get all active, non-triggered alerts
    const alerts = await PriceAlert.find({
      isActive: true,
      $or: [
        { triggeredAt: null },
        { triggeredAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Re-trigger after 24h
      ],
    });

    if (alerts.length === 0) {
      console.log("[Background Job] No active alerts to check");
      return;
    }

    // Get unique token symbols and map to CoinGecko IDs
    const uniqueSymbols = new Set(alerts.map((a) => a.tokenSymbol.toLowerCase()));
    const tokenSymbols = Array.from(uniqueSymbols);
    const coinIds = tokenSymbols
      .map((symbol) => SYMBOL_TO_COINGECKO_ID[symbol])
      .filter((id) => id !== undefined);

    if (coinIds.length === 0) {
      console.log("[Background Job] No supported tokens in alerts");
      return;
    }

    // Fetch current prices from CoinGecko (pass array, not string)
    const prices = await getSimplePrices(coinIds);

    let triggeredCount = 0;
    for (const alert of alerts) {
      const tokenSymbol = alert.tokenSymbol.toLowerCase();
      const coinId = SYMBOL_TO_COINGECKO_ID[tokenSymbol];
      
      if (!coinId) {
        console.log(`[Background Job] No CoinGecko ID mapping for ${alert.tokenSymbol}`);
        continue;
      }

      const currentPrice = prices[coinId]?.usd;

      if (!currentPrice) {
        console.log(`[Background Job] No price data for ${alert.tokenSymbol} (${coinId})`);
        continue;
      }

      // Check if alert condition is met
      const isTriggered =
        (alert.condition === "above" && currentPrice >= alert.targetPrice) ||
        (alert.condition === "below" && currentPrice <= alert.targetPrice);

      if (isTriggered) {
        // Update alert
        alert.triggeredAt = new Date();
        alert.lastNotifiedAt = new Date();
        await alert.save();

        // Create notification for user
        await createPriceAlertNotification(alert, currentPrice);

        triggeredCount++;
      }
    }

    console.log(`[Background Job] Triggered ${triggeredCount} price alerts`);
  } catch (error) {
    console.error("[Background Job] Error checking price alerts:", error);
  }
}

// Create notification for triggered price alert
async function createPriceAlertNotification(alert: any, currentPrice: number): Promise<void> {
  try {
    // Find user's wallet
    const wallet = await Wallet.findOne({ userId: alert.userId });
    if (!wallet) {
      console.log(`[Background Job] No wallet found for user ${alert.userId}, skipping notification`);
      return;
    }

    const notification = new Notification({
      walletId: wallet._id,
      category: "System",
      type: "system",
      title: `Price Alert: ${alert.tokenSymbol}`,
      description: `${alert.tokenName} is now ${alert.condition} $${alert.targetPrice.toLocaleString()}! Current price: $${currentPrice.toLocaleString()}`,
      metadata: {
        alertId: alert._id,
        tokenSymbol: alert.tokenSymbol,
        targetPrice: alert.targetPrice,
        currentPrice,
        condition: alert.condition,
      },
    });

    await notification.save();

    // Send browser push notification if user is subscribed
    await sendPushNotification(alert.userId, {
      title: `Price Alert: ${alert.tokenSymbol}`,
      body: `${alert.tokenName} is ${alert.condition} $${alert.targetPrice.toLocaleString()}!`,
      icon: "/icon-192.png",
      data: {
        url: "/notifications",
      },
    });
  } catch (error) {
    console.error("[Background Job] Error creating price alert notification:", error);
  }
}

// Send browser push notification
async function sendPushNotification(userId: string, payload: any): Promise<void> {
  try {
    const subscriptions = await UserPushSubscription.find({ userId });

    if (subscriptions.length === 0) {
      return;
    }

    // Note: Actual web push implementation requires web-push library
    // For now, we'll just log that we would send a notification
    console.log(`[Background Job] Would send push notification to ${subscriptions.length} devices`);
    
    // TODO: Implement actual web push using web-push library
    // const webpush = require('web-push');
    // for (const sub of subscriptions) {
    //   try {
    //     await webpush.sendNotification({
    //       endpoint: sub.endpoint,
    //       keys: sub.keys
    //     }, JSON.stringify(payload));
    //   } catch (err) {
    //     if (err.statusCode === 410) {
    //       // Subscription expired, delete it
    //       await UserPushSubscription.deleteOne({ _id: sub._id });
    //     }
    //   }
    // }
  } catch (error) {
    console.error("[Background Job] Error sending push notification:", error);
  }
}

// Wrap background job execution with error handling
function safeExecute(fn: () => Promise<void>, jobName: string) {
  return async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`[Background Job] Error in ${jobName}:`, error);
      // Continue running - don't crash the server
    }
  };
}

// Start background jobs
export function startBackgroundJobs(): void {
  console.log("[Background Job] Starting background jobs...");

  // Fetch crypto news every 15 minutes
  setInterval(safeExecute(fetchCryptoNews, "fetchCryptoNews"), 15 * 60 * 1000);
  // Run immediately on startup
  setTimeout(safeExecute(fetchCryptoNews, "fetchCryptoNews"), 5000);

  // Check price alerts every 5 minutes
  setInterval(safeExecute(checkPriceAlerts, "checkPriceAlerts"), 5 * 60 * 1000);
  // Run immediately on startup (after 10 seconds)
  setTimeout(safeExecute(checkPriceAlerts, "checkPriceAlerts"), 10000);

  console.log("[Background Job] Background jobs started successfully");
}

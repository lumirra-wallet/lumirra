const APP_VERSION = '2.2.0'; // Incremented to force cache clear for all users
const VERSION_KEY = 'app-version';

interface CacheStatus {
  needsClear: boolean;
  reason?: string;
}

class CacheManager {
  private isStorageDisabled(): boolean {
    try {
      const testKey = '__storage_availability_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return false;
    } catch {
      return true;
    }
  }

  checkVersion(): CacheStatus {
    if (this.isStorageDisabled()) {
      console.warn('localStorage is disabled or unavailable');
      return { needsClear: false };
    }

    try {
      const storedVersion = localStorage.getItem(VERSION_KEY);
      
      if (!storedVersion) {
        try {
          localStorage.setItem(VERSION_KEY, APP_VERSION);
        } catch (error) {
          console.warn('Failed to set version key:', error);
        }
        return { needsClear: false };
      }

      if (storedVersion !== APP_VERSION) {
        return { 
          needsClear: true, 
          reason: `App updated from ${storedVersion} to ${APP_VERSION}` 
        };
      }

      return { needsClear: false };
    } catch (error) {
      console.error('Error checking version:', error);
      return { needsClear: false };
    }
  }

  clearAllCache(): void {
    try {
      // Preserve critical keys that must survive cache clears
      const GLOBAL_RECOVERY_KEY = 'global-auto-recovery-attempts';
      const GLOBAL_RECOVERY_TIMESTAMP_KEY = 'global-auto-recovery-timestamp';
      
      const keysToPreserve = [VERSION_KEY, GLOBAL_RECOVERY_KEY, GLOBAL_RECOVERY_TIMESTAMP_KEY];
      const preservedData: Record<string, string> = {};

      keysToPreserve.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          preservedData[key] = value;
        }
      });

      localStorage.clear();
      sessionStorage.clear();
      
      // Restore preserved keys
      Object.entries(preservedData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      // Aggressively clear all cache APIs including service workers
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      
      // Unregister all service workers to prevent stale cache
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
      
      console.log('All cache cleared aggressively (recovery counters preserved, service workers unregistered)');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Performs a hard reload that bypasses ALL caches including Vite's build cache.
   * This appends a timestamp to the URL to force the browser to fetch fresh assets.
   */
  hardReload(): void {
    try {
      // CRITICAL: Update version key to current version BEFORE clearing cache
      // This prevents infinite reload loops when version bumps trigger cache clears
      try {
        localStorage.setItem(VERSION_KEY, APP_VERSION);
      } catch (versionError) {
        console.warn('Failed to update version key:', versionError);
      }
      
      // Clear all caches (version key already updated above)
      this.clearAllCache();
      
      // Force a cache-busting reload by appending timestamp
      // This ensures even Vite's compiled module cache is bypassed
      const url = new URL(window.location.href);
      url.searchParams.set('_cache_bust', Date.now().toString());
      
      // Use location.replace to bypass browser cache completely
      window.location.replace(url.toString());
    } catch (error) {
      console.error('Hard reload failed, falling back to standard reload:', error);
      window.location.reload();
    }
  }

  clearStorageOnly(): void {
    try {
      const keysToPreserve = [VERSION_KEY];
      const preservedData: Record<string, string> = {};

      keysToPreserve.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          preservedData[key] = value;
        }
      });

      localStorage.clear();
      sessionStorage.clear();

      Object.entries(preservedData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      console.log('Storage cleared (version preserved)');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  validateStorage(): boolean {
    if (this.isStorageDisabled()) {
      console.warn('localStorage is disabled');
      return false;
    }

    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return value === '1';
    } catch (error) {
      console.error('Storage validation failed:', error);
      return false;
    }
  }

  detectCorruption(): boolean {
    if (this.isStorageDisabled()) {
      return false;
    }

    try {
      const lumirraKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('lumirra-')
      );

      for (const key of lumirraKeys) {
        const value = localStorage.getItem(key);
        if (value === null || value === undefined) {
          console.warn(`Corrupted key detected: ${key}`);
          return true;
        }

        if (key.includes('JSON') || key.includes('wallet') || key.includes('user')) {
          try {
            JSON.parse(value);
          } catch {
            console.warn(`Invalid JSON in key: ${key}`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Corruption detection failed:', error);
      return false;
    }
  }

  autoCheck(): void {
    if (this.isStorageDisabled()) {
      console.warn('localStorage is disabled or unavailable. App will run with limited functionality.');
      return;
    }

    // Prevent reload loops: if we've just done a hard reload (URL has _cache_bust param), skip auto-check
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('_cache_bust')) {
      console.log('Skipping auto-check after hard reload to prevent infinite loop');
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const versionStatus = this.checkVersion();
    
    if (versionStatus.needsClear) {
      console.log(`Cache clear needed: ${versionStatus.reason}`);
      try {
        this.hardReload();
      } catch (error) {
        console.error('Failed to clear cache and reload:', error);
      }
      return;
    }

    if (!this.validateStorage()) {
      console.warn('Storage validation failed but storage is available. Skipping automatic clear to prevent reload loop.');
      return;
    }

    if (this.detectCorruption()) {
      console.warn('Storage corruption detected, attempting to clear');
      try {
        this.clearStorageOnly();
        this.hardReload();
      } catch (error) {
        console.error('Failed to clear corrupted storage:', error);
      }
      return;
    }
  }

  getRecoveryInfo(): string {
    const info = [];
    info.push(`App Version: ${APP_VERSION}`);
    
    if (this.isStorageDisabled()) {
      info.push('LocalStorage: Disabled or Unavailable');
      info.push('Storage Valid: N/A');
      info.push('Corruption Detected: N/A');
      return info.join('\n');
    }
    
    info.push(`Storage Valid: ${this.validateStorage()}`);
    info.push(`Corruption Detected: ${this.detectCorruption()}`);
    
    try {
      info.push(`LocalStorage Keys: ${Object.keys(localStorage).length}`);
    } catch {
      info.push('LocalStorage: Unavailable');
    }

    return info.join('\n');
  }
}

export const cacheManager = new CacheManager();

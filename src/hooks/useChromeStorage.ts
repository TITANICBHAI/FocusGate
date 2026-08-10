import { useState, useEffect } from 'react';

// A hook to use Chrome extension storage with a localStorage fallback for web development
export function useChromeStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Initialize
  useEffect(() => {
    try {
      if (window.chrome && chrome.storage) {
        chrome.storage.local.get([key], (result) => {
          if (result[key] !== undefined) {
            setStoredValue(result[key]);
          }
        });
      } else {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item));
        }
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Listen for changes from other contexts (like background script or options page)
  useEffect(() => {
    if (window.chrome && chrome.storage) {
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
        if (namespace === 'local' && changes[key]) {
          setStoredValue(changes[key].newValue);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      // Fallback for web development: listen to cross-tab storage events
      const storageListener = (e: StorageEvent) => {
        if (e.key === key && e.newValue !== null) {
          try {
            setStoredValue(JSON.parse(e.newValue));
          } catch (err) {}
        }
      };
      window.addEventListener('storage', storageListener);
      
      // Also listen to custom events for same-window syncing
      const customListener = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail.key === key) {
          setStoredValue(customEvent.detail.newValue);
        }
      };
      window.addEventListener('local-storage-sync', customListener);
      
      return () => {
        window.removeEventListener('storage', storageListener);
        window.removeEventListener('local-storage-sync', customListener);
      };
    }
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (window.chrome && chrome.storage) {
        chrome.storage.local.set({ [key]: valueToStore });
      } else {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(new CustomEvent('local-storage-sync', { 
          detail: { key, newValue: valueToStore } 
        }));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

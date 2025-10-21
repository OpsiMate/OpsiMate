export interface IntegrationUrlHistory {
    integrationType: string;
    urls: string[];
  }
  
  const STORAGE_KEY = 'opsimate-integration-url-history';
  
  /**
   * Get all saved integration URL histories
   */
  export function getIntegrationUrlHistories(): IntegrationUrlHistory[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as IntegrationUrlHistory[];
    } catch (error) {
      console.error('Error getting integration URL histories:', error);
      return [];
    }
  }
  
  /**
   * Get URL history for a specific integration type
   */
  export function getIntegrationUrlHistory(integrationType: string): string[] {
    const histories = getIntegrationUrlHistories();
    const history = histories.find(h => h.integrationType === integrationType);
    return history?.urls || [];
  }
  
  /**
   * Save a URL to the history for a specific integration type
   */
  export function saveIntegrationUrl(integrationType: string, url: string): void {
    try {
      // Don't save empty URLs
      if (!url || url.trim() === '') return;
  
      const histories = getIntegrationUrlHistories();
      let history = histories.find(h => h.integrationType === integrationType);
  
      if (history) {
        // Remove the URL if it already exists (to avoid duplicates)
        history.urls = history.urls.filter(u => u !== url);
        // Add it to the beginning
        history.urls.unshift(url);
        // Keep only the last 10 URLs
        history.urls = history.urls.slice(0, 10);
      } else {
        // Create new history entry
        history = {
          integrationType,
          urls: [url]
        };
        histories.push(history);
      }
  
      localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
    } catch (error) {
      console.error('Error saving integration URL:', error);
    }
  }
  
  
  
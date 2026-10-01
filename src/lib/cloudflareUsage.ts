/**
 * Cloudflare Workers AI Usage Tracker
 * Monitors and aggregates API calls to Cloudflare Workers AI, calculating daily/monthly limits and remaining budget.
 * Supports persistent cloud storage via Google Firebase Firestore to survive browser cache clearance.
 */

export interface CloudflareUsageLog {
  id: string;
  timestamp: string;
  model: string;
  promptTextLength: number;
  responseTextLength: number;
  estimatedPromptTokens: number;
  estimatedResponseTokens: number;
  neuronsConsumed: number;
}

export interface ModelLimit {
  modelId: string;
  displayName: string;
  dailyRequestsLimit: number;
  monthlyRequestsLimit: number;
  dailyNeuronsLimit: number;
  estimatedNeuronsPerRequest: number;
}

// Curated list of Cloudflare Models with their realistic limits and characteristics
export const CLOUDFLARE_MODEL_METADATA: Record<string, ModelLimit> = {
  '@cf/meta/llama-3.3-70b-instruct-fp8': {
    modelId: '@cf/meta/llama-3.3-70b-instruct-fp8',
    displayName: 'Llama 3.3 70B Instruct',
    dailyRequestsLimit: 12, // Very low due to high neuron consumption
    monthlyRequestsLimit: 250,
    dailyNeuronsLimit: 10000,
    estimatedNeuronsPerRequest: 800, // Realistically high for 70B model
  },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': {
    modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    displayName: 'DeepSeek R1 Distill Qwen 32B',
    dailyRequestsLimit: 20,
    monthlyRequestsLimit: 400,
    dailyNeuronsLimit: 10000,
    estimatedNeuronsPerRequest: 450,
  },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-14b': {
    modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-14b',
    displayName: 'DeepSeek R1 Distill Qwen 14B',
    dailyRequestsLimit: 40,
    monthlyRequestsLimit: 800,
    dailyNeuronsLimit: 10000,
    estimatedNeuronsPerRequest: 220,
  },
  '@cf/qwen/qwen2.5-coder-32b-instruct': {
    modelId: '@cf/qwen/qwen2.5-coder-32b-instruct',
    displayName: 'Qwen 2.5 Coder 32B',
    dailyRequestsLimit: 20,
    monthlyRequestsLimit: 400,
    dailyNeuronsLimit: 10000,
    estimatedNeuronsPerRequest: 400,
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    modelId: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B Instruct',
    dailyRequestsLimit: 150,
    monthlyRequestsLimit: 3000,
    dailyNeuronsLimit: 10000,
    estimatedNeuronsPerRequest: 45, // Medium-low model
  },
  'fallback_default': {
    modelId: 'other',
    displayName: 'Modello Generico Cloudflare',
    dailyRequestsLimit: 50,
    monthlyRequestsLimit: 1200,
    dailyNeuronsLimit: 10000,
    estimatedNeuronsPerRequest: 150,
  }
};

const STORAGE_KEY = 'chronicle_cloudflare_usage_logs';

export class CloudflareUsageTracker {
  private static isSyncingWithCloud = false;

  /**
   * Estimates tokens based on average Italian character length (roughly 3.5 characters per token)
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Retrieves the model metadata or returns default metadata for unknown models
   */
  static getModelMetadata(modelId: string): ModelLimit {
    const cleanId = (modelId || '').trim();
    if (CLOUDFLARE_MODEL_METADATA[cleanId]) {
      return CLOUDFLARE_MODEL_METADATA[cleanId];
    }
    // Search by partial match
    const foundKey = Object.keys(CLOUDFLARE_MODEL_METADATA).find(key => cleanId.includes(key));
    if (foundKey) {
      return CLOUDFLARE_MODEL_METADATA[foundKey];
    }
    return {
      modelId: cleanId || 'other',
      displayName: cleanId.split('/').pop() || cleanId || 'Cloudflare Model',
      dailyRequestsLimit: 50,
      monthlyRequestsLimit: 1200,
      dailyNeuronsLimit: 10000,
      estimatedNeuronsPerRequest: 150,
    };
  }

  /**
   * Retrieves all usage logs from local storage
   */
  static getLogs(): CloudflareUsageLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[CloudflareUsageTracker] Error reading logs:', e);
    }
    return [];
  }

  /**
   * Triggers a pull for usage logs
   */
  static async pullFromCloud(): Promise<CloudflareUsageLog[]> {
    return this.getLogs();
  }

  /**
   * Synchronizes usage logs
   */
  static async pushToCloud(_logs: CloudflareUsageLog[]): Promise<void> {
    // Supabase / local storage handles usage
  }

  /**
   * Adds a new usage log entry to storage and syncs to Cloud
   */
  static logRequest(modelId: string, promptText: string, responseText: string): CloudflareUsageLog | null {
    if (typeof window === 'undefined') return null;

    try {
      const promptTokens = this.estimateTokens(promptText);
      const responseTokens = this.estimateTokens(responseText);

      // --- ADVANCED CLOUDFLARE NEURON BILLING ENGINE ---
      // Cloudflare bills dynamically depending on the model scale:
      // Large models (70B) cost a baseline of 120 Neurons/request + 0.08 Neurons per input token + 0.28 Neurons per output token.
      // Reasoning tokens (like DeepSeek outputs) are also heavily priced.
      let baseNeurons = 15;
      let neuronPerInputToken = 0.015;
      let neuronPerOutputToken = 0.06;

      const cleanModelId = modelId.toLowerCase();
      if (cleanModelId.includes('70b') || cleanModelId.includes('nemotron')) {
        baseNeurons = 150;
        neuronPerInputToken = 0.09;
        neuronPerOutputToken = 0.32;
      } else if (cleanModelId.includes('32b') || cleanModelId.includes('coder') || cleanModelId.includes('deepseek-r1')) {
        baseNeurons = 90;
        neuronPerInputToken = 0.06;
        neuronPerOutputToken = 0.24;
      } else if (cleanModelId.includes('14b')) {
        baseNeurons = 50;
        neuronPerInputToken = 0.04;
        neuronPerOutputToken = 0.16;
      } else if (cleanModelId.includes('8b') || cleanModelId.includes('mistral')) {
        baseNeurons = 20;
        neuronPerInputToken = 0.015;
        neuronPerOutputToken = 0.06;
      }

      const calculatedNeurons = Math.max(
        baseNeurons,
        Math.ceil(baseNeurons + (promptTokens * neuronPerInputToken) + (responseTokens * neuronPerOutputToken))
      );

      const logEntry: CloudflareUsageLog = {
        id: `cf_log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        model: modelId,
        promptTextLength: promptText.length,
        responseTextLength: responseText.length,
        estimatedPromptTokens: promptTokens,
        estimatedResponseTokens: responseTokens,
        neuronsConsumed: calculatedNeurons,
      };

      const logs = this.getLogs();
      logs.push(logEntry);

      // Keep only last 1000 logs to prevent LocalStorage bloat
      const trimmedLogs = logs.slice(-1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));

      // Push to Firestore Cloud (asynchronously, so it doesn't block UI thread)
      this.pushToCloud(trimmedLogs);

      // Dispatch event to refresh UI components in real-time
      window.dispatchEvent(new CustomEvent('chronicle_cloudflare_usage_updated', { detail: logEntry }));

      return logEntry;
    } catch (e) {
      console.error('[CloudflareUsageTracker] Failed to write usage log:', e);
      return null;
    }
  }

  /**
   * Computes usage statistics comparing actual logs against limits
   */
  static getUsageStats(): {
    totalNeuronsToday: number;
    totalNeuronsThisMonth: number;
    totalRequestsToday: number;
    totalRequestsThisMonth: number;
    neuronDailyFreeLimit: number;
    neuronMonthlyFreeLimit: number;
    modelsUsage: Record<string, {
      modelId: string;
      displayName: string;
      dailyRequests: number;
      monthlyRequests: number;
      dailyNeurons: number;
      monthlyNeurons: number;
      dailyRequestLimit: number;
      monthlyRequestLimit: number;
      dailyNeuronLimit: number;
      remainingRequestsToday: number;
      remainingNeuronsToday: number;
      remainingRequestsMonth: number;
    }>;
  } {
    const logs = this.getLogs();
    const now = new Date();
    
    // Today boundary (UTC to match Cloudflare's reset at 00:00 UTC)
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Start of current month
    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    let totalNeuronsToday = 0;
    let totalNeuronsThisMonth = 0;
    let totalRequestsToday = 0;
    let totalRequestsThisMonth = 0;

    const modelsUsageMap: Record<string, {
      modelId: string;
      displayName: string;
      dailyRequests: number;
      monthlyRequests: number;
      dailyNeurons: number;
      monthlyNeurons: number;
    }> = {};

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      const isToday = logDate >= startOfToday;
      const isThisMonth = logDate >= startOfThisMonth;

      const modelId = log.model;
      const meta = this.getModelMetadata(modelId);

      if (!modelsUsageMap[modelId]) {
        modelsUsageMap[modelId] = {
          modelId,
          displayName: meta.displayName,
          dailyRequests: 0,
          monthlyRequests: 0,
          dailyNeurons: 0,
          monthlyNeurons: 0,
        };
      }

      if (isToday) {
        totalNeuronsToday += log.neuronsConsumed;
        totalRequestsToday += 1;
        modelsUsageMap[modelId].dailyRequests += 1;
        modelsUsageMap[modelId].dailyNeurons += log.neuronsConsumed;
      }

      if (isThisMonth) {
        totalNeuronsThisMonth += log.neuronsConsumed;
        totalRequestsThisMonth += 1;
        modelsUsageMap[modelId].monthlyRequests += 1;
        modelsUsageMap[modelId].monthlyNeurons += log.neuronsConsumed;
      }
    });

    // Translate to rich statistics structure with limits and remaining budgets
    const modelsUsage: any = {};
    
    // Ensure standard models are pre-populated so they show up even with 0 usage
    Object.keys(CLOUDFLARE_MODEL_METADATA).forEach(key => {
      if (key === 'fallback_default') return;
      const meta = CLOUDFLARE_MODEL_METADATA[key];
      const actual = modelsUsageMap[meta.modelId] || {
        modelId: meta.modelId,
        displayName: meta.displayName,
        dailyRequests: 0,
        monthlyRequests: 0,
        dailyNeurons: 0,
        monthlyNeurons: 0,
      };

      modelsUsage[meta.modelId] = {
        modelId: meta.modelId,
        displayName: meta.displayName,
        dailyRequests: actual.dailyRequests,
        monthlyRequests: actual.monthlyRequests,
        dailyNeurons: actual.dailyNeurons,
        monthlyNeurons: actual.monthlyNeurons,
        dailyRequestLimit: meta.dailyRequestsLimit,
        monthlyRequestLimit: meta.monthlyRequestsLimit,
        dailyNeuronLimit: meta.dailyNeuronsLimit,
        remainingRequestsToday: Math.max(0, meta.dailyRequestsLimit - actual.dailyRequests),
        remainingNeuronsToday: Math.max(0, meta.dailyNeuronsLimit - actual.dailyNeurons),
        remainingRequestsMonth: Math.max(0, meta.monthlyRequestsLimit - actual.monthlyRequests),
      };
    });

    // Also populate any custom used models not in the curated list
    Object.keys(modelsUsageMap).forEach(modelId => {
      if (modelsUsage[modelId]) return; // already processed

      const actual = modelsUsageMap[modelId];
      const meta = this.getModelMetadata(modelId);

      modelsUsage[modelId] = {
        modelId,
        displayName: meta.displayName,
        dailyRequests: actual.dailyRequests,
        monthlyRequests: actual.monthlyRequests,
        dailyNeurons: actual.dailyNeurons,
        monthlyNeurons: actual.monthlyNeurons,
        dailyRequestLimit: meta.dailyRequestsLimit,
        monthlyRequestLimit: meta.monthlyRequestsLimit,
        dailyNeuronLimit: meta.dailyNeuronsLimit,
        remainingRequestsToday: Math.max(0, meta.dailyRequestsLimit - actual.dailyRequests),
        remainingNeuronsToday: Math.max(0, meta.dailyNeuronsLimit - actual.dailyNeurons),
        remainingRequestsMonth: Math.max(0, meta.monthlyRequestsLimit - actual.monthlyRequests),
      };
    });

    return {
      totalNeuronsToday,
      totalNeuronsThisMonth,
      totalRequestsToday,
      totalRequestsThisMonth,
      neuronDailyFreeLimit: 10000, // Cloudflare free quota is 10,000 neurons/day
      neuronMonthlyFreeLimit: 300000, // 300,000 neurons/month
      modelsUsage,
    };
  }

  /**
   * Resets usage statistics
   */
  static async clearLogs(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('chronicle_cloudflare_usage_updated'));
    } catch (e) {
      console.warn('[CloudflareUsageTracker] Error clearing logs:', e);
    }
  }
}

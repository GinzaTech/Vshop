import { flowTracer } from './flowTracer';

interface AsyncStorageLike {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
}

export function createTracedStorage(storage: AsyncStorageLike) {
  return {
    async setItem(key: string, value: string) {
      flowTracer.track({
        type: 'STORAGE_WRITE',
        label: `AsyncStorage.setItem('${key}')`,
        input: { key, value },
        tool: 'AsyncStorage',
      });

      return storage.setItem(key, value);
    },

    async getItem(key: string) {
      const value = await storage.getItem(key);

      flowTracer.track({
        type: 'STORAGE_READ',
        label: `AsyncStorage.getItem('${key}')`,
        output: { key, value },
        tool: 'AsyncStorage',
      });

      return value;
    },

    async removeItem(key: string) {
      flowTracer.track({
        type: 'STORAGE_WRITE',
        label: `AsyncStorage.removeItem('${key}')`,
        input: { key },
        tool: 'AsyncStorage',
      });

      return storage.removeItem(key);
    },
  };
}

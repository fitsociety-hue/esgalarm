import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      padlets: [],
      webhooks: [],
      logs: [],
      monitoring: {
        isActive: false,
        interval: 5, // minutes
      },
      
      // Padlet Actions
      addPadlet: (padlet) => set((state) => ({ 
        padlets: [...state.padlets, { ...padlet, id: Date.now().toString(), lastChecked: null, lastPostId: null }] 
      })),
      updatePadlet: (id, updates) => set((state) => ({
        padlets: state.padlets.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      removePadlet: (id) => set((state) => ({
        padlets: state.padlets.filter(p => p.id !== id)
      })),
      
      // Webhook Actions
      addWebhook: (webhook) => set((state) => ({
        webhooks: [...state.webhooks, { ...webhook, id: Date.now().toString() }]
      })),
      updateWebhook: (id, updates) => set((state) => ({
        webhooks: state.webhooks.map(w => w.id === id ? { ...w, ...updates } : w)
      })),
      removeWebhook: (id) => set((state) => ({
        webhooks: state.webhooks.filter(w => w.id !== id)
      })),
      
      // Log Actions
      addLog: (log) => set((state) => ({
        logs: [{ ...log, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...state.logs].slice(0, 500)
      })),
      clearLogs: () => set({ logs: [] }),
      
      // Monitoring Actions
      setMonitoring: (updates) => set((state) => ({
        monitoring: { ...state.monitoring, ...updates }
      })),
      toggleMonitoring: () => set((state) => ({
        monitoring: { ...state.monitoring, isActive: !state.monitoring.isActive }
      }))
    }),
    {
      name: 'esg-alarm-storage',
    }
  )
);

export default useStore;

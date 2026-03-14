import { create } from 'zustand';
import {
  getConnections,
  getQueries,
  getReports,
} from '../services/api';
import type { Connection, SavedQuery, Report } from '../services/api';

interface AppState {
  // UI
  activeTab: number;
  setActiveTab: (tab: number) => void;

  // Connections
  connections: Connection[];
  connectionsLoading: boolean;
  fetchConnections: () => Promise<void>;

  // Queries
  queries: SavedQuery[];
  queriesLoading: boolean;
  fetchQueries: () => Promise<void>;

  // Reports
  reports: Report[];
  reportsLoading: boolean;
  fetchReports: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  // UI
  activeTab: 0,
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Connections
  connections: [],
  connectionsLoading: false,
  fetchConnections: async () => {
    set({ connectionsLoading: true });
    try {
      const connections = await getConnections();
      set({ connections });
    } finally {
      set({ connectionsLoading: false });
    }
  },

  // Queries
  queries: [],
  queriesLoading: false,
  fetchQueries: async () => {
    set({ queriesLoading: true });
    try {
      const queries = await getQueries();
      set({ queries });
    } finally {
      set({ queriesLoading: false });
    }
  },

  // Reports
  reports: [],
  reportsLoading: false,
  fetchReports: async () => {
    set({ reportsLoading: true });
    try {
      const reports = await getReports();
      set({ reports });
    } finally {
      set({ reportsLoading: false });
    }
  },
}));

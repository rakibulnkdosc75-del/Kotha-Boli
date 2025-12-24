
import { Story, AppSettings } from '../types';

const STORAGE_KEY = 'kotha_boli_stories';
const SETTINGS_KEY = 'kotha_boli_settings';

const defaultSettings: AppSettings = {
  isAdultModeEnabled: false,
  autoSaveInterval: 1000,
  uiTheme: 'classic'
};

export const storageService = {
  saveStories: (stories: Story[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  },
  loadStories: (): Story[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveActiveId: (id: string) => {
    localStorage.setItem('kotha_boli_active_id', id);
  },
  getActiveId: (): string | null => {
    return localStorage.getItem('kotha_boli_active_id');
  },
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
  loadSettings: (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
  }
};

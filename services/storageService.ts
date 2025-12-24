
import { Story } from '../types';

const STORAGE_KEY = 'kotha_boli_stories';

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
  }
};

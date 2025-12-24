
export interface StoryScene {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface AppSettings {
  isAdultModeEnabled: boolean;
  autoSaveInterval: number;
  uiTheme: 'classic' | 'modern';
}

export interface Story {
  id: string;
  title: string;
  author: string;
  synopsis: string;
  content: string;
  coverImage?: string;
  lastModified: number;
  category: 'Short Story' | 'Novel' | 'Poetry' | 'Experimental';
  storyboard: StoryScene[];
  wordCount?: number;
  readTime?: number;
  isMature?: boolean;
}

export enum AIModelMode {
  STANDARD = 'Standard',
  CLASSIC = 'Classic',
  THRILLER = 'Thriller',
  DIALOGUE = 'Dialogue',
  BOLD = 'Bold'
}

export interface AIPersona {
  id: AIModelMode;
  name: string;
  bnName: string;
  description: string;
  icon: string;
  color: string;
  isMature?: boolean;
}

export const AI_PERSONAS: AIPersona[] = [
  { id: AIModelMode.STANDARD, name: 'Standard', bnName: 'আধুনিক গদ্য', description: 'দৈনন্দিন সহজবোধ্য চলিত ভাষায় সাহিত্য রচনা।', icon: '✍️', color: 'bg-blue-500' },
  { id: AIModelMode.CLASSIC, name: 'Classic', bnName: 'ধ্রুপদী শৈলী', description: 'সাধু ও চলিত মিশ্রিত আভিজাত্যপূর্ণ শব্দশৈলী।', icon: '📜', color: 'bg-amber-600' },
  { id: AIModelMode.THRILLER, name: 'Thriller', bnName: 'রহস্য-রোমাঞ্চ', description: 'ছোট বাক্য ও টানটান উত্তেজনার আবহ তৈরি।', icon: '🔍', color: 'bg-slate-800' },
  { id: AIModelMode.DIALOGUE, name: 'Dialogue', bnName: 'কথোপকথন', description: 'চরিত্রের ভাবানুযায়ী প্রাণবন্ত ও নাটকীয় সংলাপ।', icon: '💬', color: 'bg-emerald-600' },
  { id: AIModelMode.BOLD, name: 'Bold', bnName: '১৮+ সাহিত্য', description: 'প্রাপ্তবয়স্কদের জন্য সাহসী ও মনস্তাত্ত্বিক আখ্যান।', icon: '🍷', color: 'bg-rose-700', isMature: true }
];

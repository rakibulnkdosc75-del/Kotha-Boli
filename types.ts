
export interface StoryScene {
  id: string;
  text: string;
  imageUrl?: string;
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
}

export const AI_PERSONAS: AIPersona[] = [
  { id: AIModelMode.STANDARD, name: 'Standard', bnName: 'সাধারণ', description: 'আধুনিক ও সহজবোধ্য গদ্যশৈলী।', icon: '✍️' },
  { id: AIModelMode.CLASSIC, name: 'Classic', bnName: 'কালজয়ী', description: 'বঙ্কিম বা রবীন্দ্রনাথের অনুপ্রেরণায় ধ্রুপদী সাহিত্যরীতি।', icon: '📜' },
  { id: AIModelMode.THRILLER, name: 'Thriller', bnName: 'রোমাঞ্চকর', description: 'রহস্য ও নাটকীয়তায় ঘেরা দ্রুতগতির লেখনী।', icon: '🔍' },
  { id: AIModelMode.DIALOGUE, name: 'Dialogue', bnName: 'সংলাপ', description: 'চরিত্রের কথোপকথন ও স্বাভাবিক বাচনভঙ্গিতে দক্ষ।', icon: '💬' },
  { id: AIModelMode.BOLD, name: 'Bold', bnName: '১৮+ ম্যাচুউর', description: 'তীব্র আবেগ ও প্রাপ্তবয়স্কদের উপযোগী মনস্তাত্ত্বিক প্লট।', icon: '🍷' }
];

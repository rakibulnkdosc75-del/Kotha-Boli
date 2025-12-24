
export interface Story {
  id: string;
  title: string;
  content: string;
  lastModified: number;
  category: 'Short Story' | 'Novel' | 'Poetry' | 'Experimental';
}

export enum AIModelMode {
  STANDARD = 'Standard',
  BOLD = 'Creative (Bold)',
  DIALOGUE = 'Dialogue Helper'
}

export interface VoiceConfig {
  voiceName: string;
  speakerName: string;
}

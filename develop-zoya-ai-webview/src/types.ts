export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: string[];
  generatedImage?: string;
  isSearchResult?: boolean;
  isImageGen?: boolean;
  isImageEdit?: boolean;
  isVision?: boolean;
}

export type FeatureMode = 'chat' | 'vision' | 'image-gen' | 'image-edit' | 'web-search';

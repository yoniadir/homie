export interface PropertyItem {
  id: string;
  title: string;
  price: string;
  location: string;
  rooms: string;
  area: string;
  floor: string;
  description: string;
  imageUrl: string;
  link: string;
  contactInfo: string;
}

export interface ScrapingResult {
  success: boolean;
  data: PropertyItem[];
  error?: string;
  timestamp: Date;
  totalItems: number;
} 
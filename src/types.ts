export enum TankStatus {
  FULL_EMPTY = 'FULL_EMPTY',
  FULL_UNKNOWN = 'FULL_UNKNOWN',
  PARTIAL = 'PARTIAL'
}

// AI Expense Analysis এর জন্য ক্যাটাগরিগুলো সুনির্দিষ্ট করা হয়েছে
export enum ExpenseCategory {
  FUEL = 'FUEL',
  OIL = 'OIL',
  SERVICE = 'SERVICE',
  PARTS = 'PARTS',
  OTHER = 'OTHER'
}

// AI Rules: Mineral (1k), Semi (2k), Full (3k) এর জন্য এনাম
export enum OilGrade {
  MINERAL = 'Mineral',
  SEMI_SYNTHETIC = 'Semi Synthetic',
  FULL_SYNTHETIC = 'Full Synthetic'
}

export type CostDisplayType = 'FUEL' | 'FUEL_OIL' | 'TOTAL';
export type AppLanguage = 'en' | 'bn';
export type AppTheme = 'light' | 'dark' | 'system';

export interface FuelLog {
  id: string;
  date: string;
  odo: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType?: string;
  stationName?: string; // AI Station Analysis এর জন্য
  tankStatus: TankStatus;
  isMileageValid: boolean;
}

export interface OilLog {
  id: string;
  date: string;
  odo: number;
  brand: string;
  grade: OilGrade; // AI এখানে গ্রেড দেখে রিমাইন্ডার সেট করবে
  quantity: number;
  cost: number;
  nextChangeKm: number; // AI প্রেডিকশন ওডোর জন্য
}

export interface MaintenanceLog {
  id: string;
  partName: string; // AI "Most Expensive Part" বের করার জন্য
  category: ExpenseCategory;
  date: string;
  odo: number;
  cost: number;
  laborCost: number;
  notes?: string;
}

export interface Reminder {
  id: string;
  type: 'OIL' | 'SERVICE' | 'PART';
  label: string;
  targetOdo: number;
  targetDate?: string;
  isCompleted: boolean;
}

export interface Bike {
  id: string;
  name: string;
  model: string;
  year: number;
  cc: number;
  purchasePrice?: number;
  purchaseDate?: string;
  initialOdo: number;
  fuelLogs: FuelLog[];
  oilLogs: OilLog[];
  maintenanceLogs: MaintenanceLog[];
  reminders: Reminder[];
}

export interface AppState {
  bikes: Bike[];
  activeBikeId: string | null;
  darkMode: boolean;
  theme: AppTheme;
  language: AppLanguage;
  currency: string;
  hasSeenSetup: boolean;
  costType: CostDisplayType;
}

export enum TankStatus {
  FULL_EMPTY = 'FULL_EMPTY',
  FULL_UNKNOWN = 'FULL_UNKNOWN',
  PARTIAL = 'PARTIAL'
}

export enum ExpenseCategory {
  FUEL = 'FUEL',
  OIL = 'OIL',
  SERVICE = 'SERVICE',
  PARTS = 'PARTS',
  OTHER = 'OTHER'
}

export enum OilGrade {
  MINERAL = 'MINERAL',
  SEMI_SYNTHETIC = 'SEMI_SYNTHETIC',
  FULL_SYNTHETIC = 'FULL_SYNTHETIC'
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
  stationName?: string;
  tankStatus: TankStatus;
  isMileageValid: boolean;
}

export interface OilLog {
  id: string;
  date: string;
  odo: number;
  brand: string;
  grade: OilGrade;
  quantity: number;
  cost: number;
  nextChangeKm: number;
}

export interface MaintenanceLog {
  id: string;
  partName: string;
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

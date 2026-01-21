export interface Brand {
  id: string;
  name: string;
  logo?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  brandId: string;
  type?: 'scooter' | 'manual' | 'electric';
  templateId?: string;
}

export interface UserCarData {
  brand: Brand | null;
  vehicle: Vehicle | null;
  odo: string;
}
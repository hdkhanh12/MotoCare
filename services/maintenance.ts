import { supabase } from './supabase';

export const getVehicleStatsApi = async (vehicleId: number) => {
  const { data, error } = await supabase
    .from('service_logs')
    .select(`
      id,
      cost,
      created_at,
      notes,
      service_rules (
        part_name
      )
    `)
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: true }); // Lấy từ cũ đến mới để vẽ biểu đồ

  if (error) throw error;
  return data;
};

export const getPersonalSchedulesApi = async (vehicleId: string) => {
  const { data, error } = await supabase
    .from('personal_schedules')
    .select('*')
    .eq('vehicle_id', vehicleId);
  if (error) throw error;
  return data || [];
};

export const addPersonalScheduleApi = async (vehicleId: string, name: string, interval: number) => {
  const { error } = await supabase
    .from('personal_schedules')
    .insert({
      vehicle_id: vehicleId,
      service_name: name,
      interval_km: interval
    });
  if (error) throw error;
};

export const deletePersonalScheduleApi = async (id: number) => {
    const { error } = await supabase.from('personal_schedules').delete().eq('id', id);
    if (error) throw error;
};
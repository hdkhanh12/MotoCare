import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { SUPPORTED_BRANDS } from '../constants/MockData';
import { supabase } from '../services/supabase';
import { Brand, Vehicle } from '../types';

interface OnboardingData {
  brand: Brand | null;
  vehicle: Vehicle | null;
  odo: string;
  plateNumber: string;
  image: string | null;
}


async function fetchVehiclesByBrand(brandName: string | undefined) {
  if (!brandName) return [];

  const { data, error } = await supabase
    .from('vehicles') 
    .select('id, name, brand, template_id') 
    .ilike('brand', `%${brandName}%`); 

  if (error) throw new Error(error.message);

  return (data || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    brandId: v.brand,
    templateId: v.template_id
  })) as Vehicle[];
}

async function createUserVehicle(payload: any) {
  const { data, error } = await supabase
    .from('user_vehicles')
    .insert([payload])
    .select() 
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export const useOnboarding = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState<OnboardingData>({
    brand: null,
    vehicle: null,
    odo: '',
    plateNumber: '',
    image: null,
  });

  const { 
    data: serverVehicles = [], 
    isLoading: isLoadingVehicles 
  } = useQuery({
    queryKey: ['vehicles-list', formData.brand?.name],
    queryFn: () => fetchVehiclesByBrand(formData.brand?.name),
    enabled: !!formData.brand, 
  });

  const saveMutation = useMutation({
    mutationFn: createUserVehicle,
    onSuccess: async (newVehicle) => {
      await AsyncStorage.setItem('last_selected_vehicle_id', newVehicle.id);
      queryClient.invalidateQueries({ queryKey: ['user-vehicles'] });
      
      router.replace('/(tabs)');
    },
    onError: (err: any) => {
      Alert.alert("Lỗi hệ thống", err.message);
    }
  });

  const selectBrand = (brand: Brand) => {
    setFormData((prev) => ({ ...prev, brand, vehicle: null }));
    setStep(2);
  };

  const selectVehicle = (vehicle: Vehicle) => {
    setFormData((prev) => ({ ...prev, vehicle }));
    setStep(3); 
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const finishOnboarding = async (overrideData?: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      Alert.alert("Lỗi", "Phiên đăng nhập hết hạn.");
      router.replace('/auth');
      return;
    }

    const finalData = { ...formData, ...overrideData };

    if (!finalData.vehicle?.id) { 
      Alert.alert("Lỗi dữ liệu", "Vui lòng chọn dòng xe.");
      return;
    }

    const payload = {
      user_id: user.id,
      brand: finalData.brand?.name,
      model: finalData.vehicle?.name,
      plate_number: finalData.plateNumber ? finalData.plateNumber.toUpperCase().trim() : '',
      image_url: finalData.image || null,  
      current_odo: parseInt(finalData.odo?.toString().replace(/\D/g, '') || '0'),
      year: new Date().getFullYear(),
      template_id: finalData.vehicle.templateId || finalData.vehicle.id 
    };

    console.log(">>> Sending payload:", payload);
    saveMutation.mutate(payload); 
  };

  return {
    step,
    data: formData,
    serverVehicles,    
    isLoadingVehicles,
    isSubmitting: saveMutation.isPending, 
    availableBrands: { SUPPORTED_BRANDS }, 
    actions: {
      selectBrand,
      selectVehicle,
      setOdo: (odo: string) => updateData({ odo }),
      setPlateNumber: (plate: string) => updateData({ plateNumber: plate }),
      goBack,
      finishOnboarding,
      updateData
    }
  };
};
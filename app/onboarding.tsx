import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { COLORS } from '../constants/Colors';
import { SUPPORTED_BRANDS } from '../constants/MockData';
import { useGlobalModal } from '../contexts/ModalContext';
import { useOnboarding } from '../hooks/useOnboarding';

export default function OnboardingScreen() {
  const { step, data, actions, serverVehicles, isLoadingVehicles, isSubmitting } = useOnboarding();
  const { showConfirm } = useGlobalModal(); 

  const [searchBrand, setSearchBrand] = useState('');
  const [searchVehicle, setSearchVehicle] = useState('');
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState('');

const filteredBrands = SUPPORTED_BRANDS.filter(b => 
   b.name.toLowerCase().includes(searchBrand.toLowerCase())
);  const filteredVehicles = serverVehicles.filter(v => v.name.toLowerCase().includes(searchVehicle.toLowerCase()));

  // --- LOGIC CHỌN ẢNH ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
        showConfirm(
            "Cần quyền truy cập",
            "Ứng dụng cần quyền này để hoạt động. Bạn có muốn mở Cài đặt để cấp quyền ngay không?",
            () => { Linking.openSettings(); }
        );
        return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, aspect: [4, 3], quality: 0.5,
    });

    if (!result.canceled) {
        setVehicleImage(result.assets[0].uri);
        actions.updateData({ image: result.assets[0].uri });
    }
  };

  const handleFinish = () => {
    const finalData = {
        ...data,
        image: vehicleImage, 
        plateNumber: plateNumber.toUpperCase() 
    };
    actions.finishOnboarding(finalData); 
  };

  // CHỌN HÃNG 
  const renderBrandSelection = () => (
    <View className="flex-1">
      <View className="px-6 py-2">
        <TouchableOpacity 
            onPress={actions.goBack}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center shadow-sm"
        >
            <MaterialIcons name="arrow-back-ios" size={18} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <View className="px-6 mb-4">
        <Text className="text-slate-900 text-3xl font-bold">Bạn đi xe gì?</Text>
        <Text className="text-slate-500 text-base mt-2">Bước 1: Chọn hãng sản xuất</Text>
      </View>
      
      <View className="px-6 mb-6">
        <Input 
          placeholder="Tìm tên hãng..." 
          value={searchBrand}
          onChangeText={setSearchBrand}
          icon={<MaterialIcons name="search" size={24} color="#94A3B8" />}
        />
      </View>

      <FlatList 
        data={filteredBrands}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 24 }}
        renderItem={({ item }) => (
            <TouchableOpacity 
              className="w-[48%] aspect-square mb-4 rounded-xl items-center justify-center border-2 bg-white border-slate-100 active:bg-slate-50 active:border-teal-500"
              onPress={() => actions.selectBrand(item)}
            >
              <View className="w-14 h-14 rounded-full bg-slate-50 items-center justify-center mb-3">
                 <MaterialIcons name="two-wheeler" size={32} color={COLORS.textSub} />
              </View>
              <Text className="font-bold text-base text-slate-700">{item.name}</Text>
            </TouchableOpacity>
        )}
      />
    </View>
  );

  // CHỌN DÒNG XE
  const renderVehicleSelection = () => (
    <View className="flex-1">
      <View className="px-6 py-2">
        <TouchableOpacity onPress={actions.goBack} className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center shadow-sm">
            <MaterialIcons name="arrow-back-ios" size={18} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <View className="px-6 mb-4">
        <Text className="text-slate-900 text-3xl font-bold">{data.brand?.name}</Text>
        <Text className="text-slate-500 text-base mt-2">Bước 2: Chọn dòng xe bạn đang đi</Text>
      </View>
      
      <View className="px-6 mb-6">
        <Input 
          placeholder={`Tìm xe ${data.brand?.name}...`} 
          value={searchVehicle}
          onChangeText={setSearchVehicle}
          icon={<MaterialIcons name="search" size={24} color="#94A3B8" />}
        />
      </View>

      {isLoadingVehicles ? (
          <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text className="text-slate-400 mt-4">Đang tải danh sách xe...</Text>
          </View>
      ) : (
          <FlatList 
            data={filteredVehicles}
            numColumns={2}
            keyExtractor={(item) => item.id}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 24 }}
            ListEmptyComponent={
                <View className="items-center mt-10">
                    <Text className="text-slate-400">Không tìm thấy xe nào.</Text>
                </View>
            }
            renderItem={({ item }) => (
                <TouchableOpacity 
                  className="w-[48%] aspect-[1.1] mb-4 rounded-xl items-center justify-center border-2 bg-white border-slate-100 active:bg-teal-50 active:border-teal-500"
                  onPress={() => actions.selectVehicle(item)}
                >
                  <Text className="font-bold text-base text-slate-700 text-center px-2">{item.name}</Text>
                </TouchableOpacity>
            )}
          />
      )}
    </View>
  );

  // FORM CUỐI (ĐÃ SỬA)
  const renderFinalForm = () => (
    <ScrollView 
        className="flex-1 px-6 pt-4" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
    >
      {/* Nút Back */}
      <TouchableOpacity onPress={actions.goBack} className="mb-6 w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center shadow-sm">
         <MaterialIcons name="arrow-back-ios" size={18} color="#0F172A" />
      </TouchableOpacity>

      {/* Upload Ảnh */}
      <View className="items-center mb-8">
        <TouchableOpacity onPress={pickImage} className="w-32 h-32 rounded-full bg-white border-2 border-dashed border-slate-300 items-center justify-center overflow-hidden shadow-sm">
           {vehicleImage ? (
             <Image source={{ uri: vehicleImage }} className="w-full h-full" resizeMode="cover" />
           ) : (
             <View className="items-center">
                <MaterialIcons name="add-a-photo" size={32} color="#94A3B8" />
                <Text className="text-xs text-slate-400 font-bold mt-1">Thêm ảnh xe</Text>
             </View>
           )}
        </TouchableOpacity>
        {!vehicleImage && <Text className="text-xs text-slate-400 mt-2">Chạm để tải ảnh lên (tùy chọn)</Text>}
      </View>

      <View>
        <Input label="Hãng xe" value={data.brand?.name} editable={false} />
        <Input label="Dòng xe" value={data.vehicle?.name} editable={false} icon={<MaterialIcons name="electric-moped" size={24} color="#94A3B8" />} />

        <View className="flex-row gap-4">
            <View className="flex-1"><Input label="Năm SX" placeholder="2023" keyboardType="numeric" /></View>
            <View className="flex-[1.5]">
                <Input 
                    label="Biển số" 
                    placeholder="29AA-123.45" 
                    autoCapitalize="characters" 
                    value={plateNumber} 
                    onChangeText={(text) => {
                        setPlateNumber(text);
                        actions.setPlateNumber(text);
                    }} 
                />
            </View>
        </View>

        <Input 
          label="Số ODO hiện tại"
          placeholder="0"
          keyboardType="numeric"
          suffix="km"
          value={data.odo?.toString()} 
          onChangeText={actions.setOdo}
          icon={<MaterialIcons name="speed" size={20} color="#94A3B8" />}
        />
        
        <Text className="text-xs text-slate-400 ml-1 mb-10">
             Chúng tôi dùng số ODO để nhắc lịch bảo dưỡng chuẩn xác hơn.
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        
        {/* Nội dung chính */}
        {step === 1 && renderBrandSelection()}
        {step === 2 && renderVehicleSelection()}
        {step === 3 && renderFinalForm()}

        {/* Footer Button */}
        {step === 3 && (
            <View className="p-6 bg-white border-t border-slate-100">
                <Button 
                    title={isSubmitting ? "Đang xử lý..." : "Hoàn tất"} 
                    onPress={handleFinish} 
                    disabled={isSubmitting}
                    icon={!isSubmitting ? <MaterialIcons name="check-circle" size={24} color="white" /> : undefined} 
                />
                {isSubmitting && <ActivityIndicator className="mt-2" color={COLORS.primary} />}
            </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
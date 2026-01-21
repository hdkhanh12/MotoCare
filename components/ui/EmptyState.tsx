import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/Colors';

interface EmptyStateProps {
  onAddPress: () => void;
}

export const EmptyState = ({ onAddPress }: EmptyStateProps) => {
  return (
    <View className="flex-1 bg-[#F8FCFB] items-center justify-center">
      <View className="w-full items-center justify-center px-6">
        
        <View className="w-full max-w-[320px] aspect-square mb-8 relative items-center justify-center">
             <View className="absolute w-64 h-64 bg-teal-50 rounded-full" />
             <View className="absolute w-48 h-48 bg-teal-100/50 rounded-full" />
             <MaterialIcons name="handyman" size={100} color={COLORS.primary} style={{ opacity: 0.9 }} />
        </View>

        <View className="items-center justify-center gap-3 mb-10 max-w-[320px]">
             <Text className="text-2xl font-bold text-slate-900 text-center leading-tight">
                Chào mừng đến MotoCare!
             </Text>
             <Text className="text-base text-slate-500 text-center leading-relaxed px-4">
                Trợ lý sức khỏe xe máy cá nhân của bạn. Theo dõi, bảo dưỡng và giúp xe luôn vận hành êm ái.
             </Text>
        </View>

        <TouchableOpacity 
            onPress={onAddPress}
            activeOpacity={0.8}
            className="w-full max-w-[320px] h-14 items-center justify-center bg-[#13b9a5] rounded-2xl shadow-lg shadow-teal-500/30"
        >
             <Text className="text-lg font-bold tracking-wide text-white">Thêm Xe Của Tôi</Text>
        </TouchableOpacity>

        <Text className="mt-6 text-xs text-slate-400 font-medium">
             Bắt đầu bằng việc thêm thông tin xe
        </Text>

      </View>
    </View>
  );
};
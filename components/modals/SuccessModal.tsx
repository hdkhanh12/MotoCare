import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface SuccessModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
}

export const SuccessModal = ({ visible, title = "Thành công", message, onClose }: SuccessModalProps) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white w-[80%] rounded-2xl p-6 items-center shadow-xl">
          
          <View className="w-16 h-16 bg-teal-50 rounded-full items-center justify-center mb-4">
            <MaterialIcons name="check-circle" size={40} color="#0D9488" />
          </View>

          <Text className="text-xl font-bold text-slate-800 mb-2 text-center">
            {title}
          </Text>

          {message && (
            <Text className="text-slate-500 text-center mb-6 leading-5">
              {message}
            </Text>
          )}

          <TouchableOpacity 
            onPress={onClose}
            className="w-full py-3 bg-teal-600 rounded-xl items-center active:bg-teal-700"
          >
            <Text className="text-white font-bold text-base">Tuyệt vời</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface Props {
  children: React.ReactNode;
  className?: string;
  offset?: number;
}

export const KeyboardSafeView = ({ children, className = "bg-[#F8FAFC]", offset = 0 }: Props) => {
  return (
    // LỚP 1: Bấm ra ngoài -> Tắt phím
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1">
        
        {/* LỚP 2: Xử lý đẩy giao diện */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          
          // Bù trừ chiều cao Header
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 + offset : 0}
          
          className="flex-1"
        >
          {/* LỚP 3: Cuộn nội dung */}
          <ScrollView
            className={`flex-1 ${className}`}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};
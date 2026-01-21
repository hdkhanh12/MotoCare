import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: React.ReactNode;
  suffix?: string;
}

export const Input = ({ label, icon, suffix, className = '', editable = true, ...props }: InputProps) => {
  const containerStyle = editable 
    ? "bg-white border-slate-200 focus:border-teal-500" 
    : "bg-slate-100 border-transparent";

  const textStyle = editable
    ? "text-slate-900"
    : "text-slate-500 font-bold";

  return (
    <View className={`mb-4 ${className}`}>
      {label && (
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
          {label}
        </Text>
      )}
      
      <View className={`flex-row items-center border rounded-xl h-14 px-4 ${containerStyle}`}>
        {icon && <View className="mr-3 opacity-70">{icon}</View>}
        
        <TextInput 
          className={`flex-1 text-base font-medium h-full ${textStyle}`}
          placeholderTextColor="#94A3B8"
          editable={editable}
          {...props} 
        />

        {suffix && (
          <Text className="text-slate-500 font-medium ml-2">{suffix}</Text>
        )}
      </View>
    </View>
  );
};
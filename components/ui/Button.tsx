import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native'; // <--- Đã thêm View vào đây

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const Button = ({ 
  title, 
  variant = 'primary', 
  loading = false, 
  icon,
  className = '', 
  ...props 
}: ButtonProps) => {
  
  let bgClass = 'bg-primary';
  let textClass = 'text-white';

  if (variant === 'outline') {
    bgClass = 'bg-transparent border border-primary';
    textClass = 'text-primary';
  } else if (variant === 'ghost') {
    bgClass = 'bg-transparent';
    textClass = 'text-slate-500';
  }

  if (props.disabled) {
    bgClass = 'bg-slate-300';
    textClass = 'text-slate-500';
  }

  return (
    <TouchableOpacity 
      className={`flex-row items-center justify-center py-3.5 px-6 rounded-xl ${bgClass} ${className}`}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#14b8a5' : 'white'} />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={`font-bold text-base ${textClass}`}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
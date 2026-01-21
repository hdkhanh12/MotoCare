import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
}

export const Card = ({ children, className = '', style, ...props }: CardProps) => {
  return (
    <View 
      className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 ${className}`}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};
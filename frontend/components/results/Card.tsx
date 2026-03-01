
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ children, className = '', style }) => {
  return (
    <div
      className={`glass rounded-2xl p-6 border border-slate-200 dark:border-slate-800 animate-slide-up hover:border-accent-violet/40 transition-all duration-500 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

export default Card;

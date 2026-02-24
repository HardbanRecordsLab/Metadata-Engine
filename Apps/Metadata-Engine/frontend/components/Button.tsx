import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'lg' | 'default' | 'sm';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'default',
  fullWidth = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:ring-offset-slate-900 focus:ring-accent-violet disabled:opacity-50 disabled:cursor-wait';

  const variantClasses = {
    primary: 'text-white bg-gradient-to-r from-accent-violet to-accent-blue shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30 hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-light-text dark:text-dark-text',
    outline: 'bg-transparent border-2 border-slate-200 dark:border-slate-800 hover:border-accent-violet/50 hover:bg-accent-violet/5 text-slate-700 dark:text-slate-300',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
  };

  const sizeClasses = {
    lg: 'px-8 py-4 text-lg',
    default: 'px-5 py-3 text-sm',
    sm: 'px-4 py-2 text-xs uppercase tracking-wider',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`;

  return (
    <button className={combinedClasses} {...props}>
      {children}
    </button>
  );
};

export default Button;
import React from 'react';

type ButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) => {
  const baseClasses = 'rounded-full font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center justify-center';
  
  const variantClasses = {
    primary: 'bg-black text-white hover:bg-black/90 focus:ring-black/30 shadow-sm',
    secondary: 'bg-white text-black border border-black/10 hover:bg-black/5 focus:ring-black/20',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  };
  
  const sizeClasses = {
    sm: 'py-1.5 px-3.5 text-xs',
    md: 'py-2 px-5 text-sm',
    lg: 'py-2.5 px-6 text-base',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled 
    ? 'opacity-40 cursor-not-allowed' 
    : 'cursor-pointer hover:transform hover:scale-[1.02] active:scale-[0.98]';
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;

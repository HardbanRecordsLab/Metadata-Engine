import React, { useEffect, useState } from 'react';
import { Check, XCircle, Info } from './icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success' }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
    }, 2500); // Animation is 0.5s, so this gives 2s visibility
    return () => clearTimeout(timer);
  }, [message, type]);
  
  const config = {
      success: { bgColor: 'bg-green-500', Icon: Check },
      error: { bgColor: 'bg-red-500', Icon: XCircle },
      info: { bgColor: 'bg-blue-500', Icon: Info },
  };

  const { bgColor, Icon } = config[type] || config.success;

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 text-white ${bgColor} rounded-full shadow-lg z-50 ${show ? 'animate-toast-in' : 'animate-toast-out'}`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-semibold">{message}</span>
    </div>
  );
};

export default Toast;
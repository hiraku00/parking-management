import React from 'react';

type CardProps = {
  children: React.ReactNode;
  title?: string;
  className?: string;
};

const Card: React.FC<CardProps> = ({ children, title, className = '' }) => {
  return (
    <div className={`apple-card bg-white/90 rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="text-lg font-medium text-black">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export default Card;

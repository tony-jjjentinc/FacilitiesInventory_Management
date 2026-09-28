import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="40" height="40" rx="8" fill="#0f172a" />
      {/* Modern architectural / inventory geometric grid mark */}
      <path
        d="M12 14H28M12 20H28M12 26H22"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect
        x="24"
        y="23"
        width="5"
        height="5"
        rx="1"
        fill="#3b82f6"
      />
    </svg>
  );
};

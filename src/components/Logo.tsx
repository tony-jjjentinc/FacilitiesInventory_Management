import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 32, className = '' }) => {
  return (
    <img
      width={'auto'}
      height={size}
      src="https://cdn.jsdelivr.net/gh/tony-jjjentinc/assets@latest/images/logo/jjjei_stacked-dark.png"
      className={className}
    >
    </img>
  );
};

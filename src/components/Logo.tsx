import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  variant?: "light" | "dark" | "default";
}

export const Logo: React.FC<LogoProps> = ({ size = 32, className = '', variant = "dark" }) => {
  return (
    <img
      width={'auto'}
      height={size}
      src={`https://cdn.jsdelivr.net/gh/tony-jjjentinc/assets@latest/images/logo/jjjei_stacked${variant == `default` ? "" : `-${variant}`}.png`}
      alt="JJJEI Logo"
      className={className ? className : " d-none d-md-block"}
    />
  );
};

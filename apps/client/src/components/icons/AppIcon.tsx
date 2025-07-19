import { SVGProps } from "react";

export const AppIcon = (props: SVGProps<SVGSVGElement>) => {
  // Ensure unique IDs for the gradients to avoid conflicts
  const uniqueId = `opsi-mate-logo-${Math.random().toString(36).substring(2, 9)}`;
  
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" fill="none" {...props}>
      <path d="M400 150C261.93 150 150 261.93 150 400C150 538.07 261.93 650 400 650C538.07 650 650 538.07 650 400C650 261.93 538.07 150 400 150Z" fill={`url(#${uniqueId}-paint0)`}/>
      <path d="M650 250L450 550L650 650L750 350L650 250Z" fill={`url(#${uniqueId}-paint1)`}/>
      <defs>
        <linearGradient id={`${uniqueId}-paint0`} x1="150" y1="150" x2="650" y2="650" gradientUnits="userSpaceOnUse">
          <stop stopColor="#36A9E1"/>
          <stop offset="1" stopColor="#1B75BC"/>
        </linearGradient>
        <linearGradient id={`${uniqueId}-paint1`} x1="450" y1="250" x2="750" y2="650" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1B75BC"/>
          <stop offset="1" stopColor="#283583"/>
        </linearGradient>
      </defs>
    </svg>
  );
}; 
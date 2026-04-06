import React from 'react';

const HyperProtectIcon = ({ size = 18, style = {} }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hp-gradient-shadow" x1="23.449" y1="31.196" x2="23.52" y2="5.175" gradientUnits="userSpaceOnUse">
          <stop offset=".419" stopColor="#000" stopOpacity="0"/>
          <stop offset=".958" stopColor="#000"/>
        </linearGradient>
        <mask id="hp-mask" x="0" y="0" width="32" height="32" maskUnits="userSpaceOnUse">
          <g>
            <path d="m26,4v14.298c0,3.205-2.724,6.192-5.5,7.794l-4.5,2.598-4.5-2.598c-2.776-1.603-5.5-4.589-5.5-7.794V4h21m-1-2H6c-1.105,0-2,.895-2,2v14.298c0,3.93,3.097,7.561,6.5,9.526l5.5,3.175,5.5-3.175c3.404-1.965,6.5-5.596,6.5-9.526V4c0-1.105-.895-2-2-2h0Z" fill="#fff"/>
            <rect x="16.5" y="4" width="14" height="17" fill="url(#hp-gradient-shadow)"/>
            <rect x="24" y="2" width="4" height="2" fill="#fff"/>
          </g>
        </mask>
        <linearGradient id="hp-gradient-main" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset=".1" stopColor="#0f62fe"/>
          <stop offset=".9" stopColor="#1192e8"/>
        </linearGradient>
      </defs>
      <g mask="url(#hp-mask)">
        <rect y="0" width="32" height="32" fill="url(#hp-gradient-main)"/>
      </g>
      <path d="m16,22l-2.139-1.013c-1.738-.822-2.861-2.597-2.861-4.52v-6.468h10v6.468c0,1.923-1.123,3.697-2.861,4.52l-2.139,1.013Zm-3-10v4.468c0,1.153.674,2.218,1.717,2.711l1.283.607,1.283-.607c1.043-.493,1.717-1.558,1.717-2.711v-4.468h-6Z" fill="#001d6c"/>
    </svg>
  );
};

export default HyperProtectIcon;

// Made with Bob

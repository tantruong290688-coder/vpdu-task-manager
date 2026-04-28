import React from 'react';

export default function AttachmentFileIcon({ fileInfo, className = 'w-10 h-10', textClassName = 'text-sm' }) {
  const { color, text } = fileInfo;
  
  return (
    <div 
      className={`relative flex items-center justify-center text-white shrink-0 shadow-sm ${color} ${className}`}
      style={{ 
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
        borderRadius: '6px'
      }}
    >
      {/* Nếp gấp giả lập */}
      <div 
        className="absolute top-0 right-0 w-[10px] h-[10px] bg-white/40 shadow-sm"
        style={{
          borderBottomLeftRadius: '4px'
        }}
      ></div>
      
      <span className={`font-bold select-none ${textClassName}`}>{text}</span>
    </div>
  );
}

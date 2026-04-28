import React from 'react';
import AttachmentFileIcon from './AttachmentFileIcon';
import { Download } from 'lucide-react';
import { getFileTypeInfo } from '../../utils/fileType';

export default function AttachmentMessageCard({ 
  fileName, 
  fileSize, 
  fileType, 
  fileUrl,
  isMe
}) {
  const fileInfo = getFileTypeInfo(fileName, fileType);
  
  if (fileInfo.type === 'image') {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-black/10 dark:border-white/10 relative group/img max-w-[240px] sm:max-w-xs">
        <img src={fileUrl} alt={fileName || "attachment"} className="max-h-60 max-w-full w-auto object-contain bg-black/5 dark:bg-white/5 transition-transform duration-300 group-hover/img:scale-105" />
      </a>
    );
  }

  const getViewerUrl = () => {
    if (fileInfo.type === 'word') {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}`;
    }
    if (fileInfo.type === 'excel') {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
    }
    return fileUrl;
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'tai-lieu';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Lỗi tải xuống:', err);
      window.open(fileUrl, '_blank');
    }
  };

  const textColor = isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200';
  const subtextColor = isMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400';
  const hoverBg = isMe ? 'hover:bg-black/10' : 'hover:bg-black/5 dark:hover:bg-white/10';

  return (
    <a 
      href={getViewerUrl()}
      target="_blank" 
      rel="noopener noreferrer"
      className={`group/file flex items-center gap-3 p-2.5 bg-black/5 dark:bg-white/5 ${hoverBg} rounded-xl border border-black/5 dark:border-white/5 transition-all max-w-[260px] sm:max-w-[300px] w-full shadow-sm`}
    >
      <AttachmentFileIcon fileInfo={fileInfo} className="w-10 h-10" textClassName="text-sm" />
      
      <div className="overflow-hidden flex-1 flex flex-col justify-center">
        <p className={`text-sm font-semibold truncate ${textColor}`} title={fileName}>
          {fileName || 'Tài liệu đính kèm'}
        </p>
        <p className={`text-[11px] mt-0.5 ${subtextColor}`}>
          {fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
        </p>
      </div>
      
      <button
        onClick={handleDownload}
        className={`p-2 rounded-full shrink-0 transition-colors ${
          isMe 
            ? 'text-blue-100 hover:text-white hover:bg-white/20' 
            : 'text-slate-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10'
        }`}
        title="Tải xuống"
      >
        <Download size={18} />
      </button>
    </a>
  );
}

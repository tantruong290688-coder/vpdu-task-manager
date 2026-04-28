import React from 'react';
import AttachmentFileIcon from './AttachmentFileIcon';
import { Download } from 'lucide-react';
import { getFileTypeInfo } from '../../utils/fileType';

export default function AttachmentMessageCard({ 
  fileName, 
  fileSize, 
  fileType, 
  fileUrl,
  isMe,
  isStandalone
}) {
  const fileInfo = getFileTypeInfo(fileName, fileType);
  
  if (fileInfo.type === 'image') {
    const imgRounded = isStandalone 
      ? (isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm') 
      : 'rounded-xl';
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={`block overflow-hidden relative group/img max-w-[240px] sm:max-w-xs ${imgRounded} ${isStandalone ? 'border border-slate-200 dark:border-slate-700 shadow-sm' : 'border border-black/10 dark:border-white/10'}`}>
        <img src={fileUrl} alt={fileName || "attachment"} className="max-h-60 max-w-full w-auto object-contain bg-slate-100 dark:bg-slate-800 transition-transform duration-300 group-hover/img:scale-105" />
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

  let containerClass = '';
  let textColor = '';
  let subtextColor = '';
  let hoverBg = '';
  let btnClass = '';

  if (isStandalone) {
    if (isMe) {
      containerClass = 'bg-blue-600 border border-blue-500 shadow-sm rounded-2xl rounded-tr-sm';
      textColor = 'text-white';
      subtextColor = 'text-blue-100';
      hoverBg = 'hover:bg-blue-700';
      btnClass = 'text-blue-100 hover:text-white hover:bg-white/20';
    } else {
      containerClass = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl rounded-tl-sm';
      textColor = 'text-slate-800 dark:text-slate-200';
      subtextColor = 'text-slate-500 dark:text-slate-400';
      hoverBg = 'hover:bg-slate-50 dark:hover:bg-slate-700/50';
      btnClass = 'text-slate-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10';
    }
  } else {
    containerClass = 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl';
    textColor = isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200';
    subtextColor = isMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400';
    hoverBg = isMe ? 'hover:bg-black/10' : 'hover:bg-black/5 dark:hover:bg-white/10';
    btnClass = isMe 
      ? 'text-blue-100 hover:text-white hover:bg-white/20' 
      : 'text-slate-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10';
  }

  return (
    <a 
      href={getViewerUrl()}
      target="_blank" 
      rel="noopener noreferrer"
      className={`group/file flex items-center gap-3 p-2.5 transition-all max-w-[260px] sm:max-w-[300px] w-full ${containerClass} ${hoverBg}`}
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
        className={`p-2 rounded-full shrink-0 transition-colors ${btnClass}`}
        title="Tải xuống"
      >
        <Download size={18} />
      </button>
    </a>
  );
}

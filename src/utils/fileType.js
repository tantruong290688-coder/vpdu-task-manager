export const getFileTypeInfo = (fileName = '', mimeType = '') => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const type = (mimeType || '').toLowerCase();

  // Word
  if (['doc', 'docx'].includes(extension) || type.includes('msword') || type.includes('wordprocessingml')) {
    return { type: 'word', color: 'bg-blue-500', text: 'W', label: 'Word' };
  }
  
  // Excel
  if (['xls', 'xlsx', 'csv'].includes(extension) || type.includes('ms-excel') || type.includes('spreadsheetml') || type.includes('csv')) {
    return { type: 'excel', color: 'bg-emerald-500', text: 'X', label: 'Excel' };
  }

  // PDF
  if (extension === 'pdf' || type.includes('pdf')) {
    return { type: 'pdf', color: 'bg-red-500', text: 'PDF', label: 'PDF' };
  }

  // Image
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension) || type.startsWith('image/')) {
    return { type: 'image', color: 'bg-purple-500', text: 'IMG', label: 'Image' };
  }

  // ZIP/Archive
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) || type.includes('zip') || type.includes('compressed')) {
    return { type: 'archive', color: 'bg-amber-500', text: 'ZIP', label: 'Archive' };
  }

  // Text
  if (['txt', 'md'].includes(extension) || type.startsWith('text/')) {
    return { type: 'text', color: 'bg-slate-500', text: 'TXT', label: 'Text' };
  }

  // Default
  return { type: 'default', color: 'bg-slate-500', text: 'FILE', label: 'File' };
};

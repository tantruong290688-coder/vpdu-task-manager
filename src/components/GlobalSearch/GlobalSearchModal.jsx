import { useState, useEffect, useRef } from 'react';
import { Search, X, User, CheckCircle2, MessageSquare, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tasks: [], profiles: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setResults({ tasks: [], profiles: [], messages: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query);
      } else {
        setResults({ tasks: [], profiles: [], messages: [] });
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async (q) => {
    setLoading(true);
    try {
      const [tasksRes, profilesRes, messagesRes] = await Promise.all([
        supabase.from('tasks').select('id, title, code').or(`title.ilike.%${q}%,code.ilike.%${q}%`).limit(5),
        supabase.from('profiles').select('id, full_name, role').ilike('full_name', `%${q}%`).limit(5),
        supabase.from('messages').select('id, content, task_id').ilike('content', `%${q}%`).limit(5)
      ]);

      setResults({
        tasks: tasksRes.data || [],
        profiles: profilesRes.data || [],
        messages: messagesRes.data || []
      });
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    const totalResults = results.tasks.length + results.profiles.length + results.messages.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalResults);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalResults) % totalResults);
    } else if (e.key === 'Enter') {
      navigateToSelected();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const navigateToSelected = () => {
    const all = [
      ...results.tasks.map(t => ({ type: 'task', id: t.id })),
      ...results.profiles.map(p => ({ type: 'profile', id: p.id })),
      ...results.messages.map(m => ({ type: 'message', id: m.id, taskId: m.task_id }))
    ];
    
    const selected = all[selectedIndex];
    if (!selected) return;

    if (selected.type === 'task') {
      navigate(`/all-tasks?open=${selected.id}`);
    } else if (selected.type === 'profile') {
      navigate(`/admin?user=${selected.id}`);
    } else if (selected.type === 'message') {
      navigate(`/all-tasks?open=${selected.taskId}`); // Mở task chứa tin nhắn
    }
    onClose();
  };

  if (!isOpen) return null;

  const flatResults = [
    ...results.tasks.map(t => ({ ...t, _type: 'task' })),
    ...results.profiles.map(p => ({ ...p, _type: 'profile' })),
    ...results.messages.map(m => ({ ...m, _type: 'message' }))
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Search Input */}
        <div className="relative p-6 border-b border-slate-100 dark:border-slate-800">
          <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm nhiệm vụ, cán bộ, hoặc tin nhắn... (Ctrl+K)"
            className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl pl-14 pr-12 py-4 text-[16px] font-bold text-slate-800 dark:text-white border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all"
          />
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && <Loader2 size={20} className="text-blue-500 animate-spin" />}
            <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 text-[11px] font-black px-1.5 py-0.5 rounded shadow-sm">ESC</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
          {flatResults.length > 0 ? (
            <div className="space-y-1">
              {flatResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item._type}-${item.id}`}
                    onClick={() => { setSelectedIndex(idx); navigateToSelected(); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      {item._type === 'task' && <CheckCircle2 size={20} className={isSelected ? 'text-white' : 'text-blue-500'} />}
                      {item._type === 'profile' && <User size={20} className={isSelected ? 'text-white' : 'text-green-500'} />}
                      {item._type === 'message' && <MessageSquare size={20} className={isSelected ? 'text-white' : 'text-amber-500'} />}
                    </div>

                    <div className="flex-1 text-left">
                      <p className={`text-[14px] font-black ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.title || item.full_name || item.content}
                      </p>
                      <p className={`text-[11px] font-bold uppercase tracking-widest opacity-60 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                        {item._type === 'task' ? `Nhiệm vụ • ${item.code}` : item._type === 'profile' ? `Cán bộ • ${item.role}` : 'Tin nhắn'}
                      </p>
                    </div>

                    <ChevronRight size={18} className={`opacity-40 ${isSelected ? 'text-white' : ''}`} />
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-20 text-center text-slate-400">
              <Search size={40} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold text-[15px]">Không tìm thấy kết quả cho "{query}"</p>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <div className="max-w-[200px] mx-auto space-y-4">
                <div className="flex items-center gap-3 text-[12px] font-bold">
                  <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">↑↓</span>
                  <span>Di chuyển</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] font-bold">
                  <span className="w-8 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">Enter</span>
                  <span>Mở chi tiết</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-[11px] font-black uppercase text-slate-400 tracking-tighter">
          <span>Hệ thống tìm kiếm thông minh v2.0</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" /> Nhiệm vụ
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Cán bộ
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" /> Tin nhắn
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

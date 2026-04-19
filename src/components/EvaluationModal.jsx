import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';

export default function EvaluationModal({ isOpen, onClose, task, onEvaluated }) {
  const { profile } = useAuth();
  
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      setScore(task.evaluation_score !== null ? task.evaluation_score.toString() : '');
      setComment(task.evaluation_comment || '');
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const canEvaluate = profile?.id === task.assigned_by || profile?.role === 'admin';
  const isEvaluated = task.evaluation_score !== null;

  const calculateRank = (val) => {
    const s = parseInt(val, 10);
    if (isNaN(s)) return '';
    if (s < 50) return 'Không hoàn thành';
    if (s < 70) return 'Hoàn thành';
    if (s < 90) return 'Tốt';
    return 'Xuất sắc';
  };

  const getRankColor = (rank) => {
    if (rank === 'Xuất sắc') return 'text-purple-600 bg-purple-50 border-purple-200';
    if (rank === 'Tốt') return 'text-blue-600 bg-blue-50 border-blue-200';
    if (rank === 'Hoàn thành') return 'text-green-600 bg-green-50 border-green-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const currentRank = calculateRank(score);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEvaluate) return;
    
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      toast.error('Điểm đánh giá phải từ 0 đến 100');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        evaluation_score: numScore,
        evaluation_rank: currentRank,
        evaluation_comment: comment,
        evaluated_by: profile.id,
        evaluated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
      if (error) throw error;

      await writeLog({
        actorId: profile.id,
        actorName: profile.full_name,
        actorRole: profile.role,
        action: 'Đánh giá nhiệm vụ',
        taskId: task.id,
        taskCode: task.code,
        note: `Đánh giá ${numScore} điểm (${currentRank})`,
      });

      // Gửi thông báo cho người thực hiện
      if (task.assignee_id && task.assignee_id !== profile.id) {
        await supabase.from('notifications').insert([{
          user_id: task.assignee_id,
          task_id: task.id,
          message: `Nhiệm vụ [${task.code}] đã được đánh giá: ${numScore} điểm (${currentRank}).`
        }]);
      }

      toast.success('Đã lưu đánh giá!');
      onEvaluated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu đánh giá: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 z-[100] flex sm:items-center justify-center sm:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111827] w-full sm:max-w-lg shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl border border-transparent dark:border-slate-800 relative animate-in slide-in-from-bottom-2 sm:slide-in-from-bottom-4 duration-200">
        
        <div className="px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#111827]">
          <h2 className="text-[17px] sm:text-[18px] font-extrabold text-slate-800 dark:text-white">Đánh giá kết quả</h2>
          <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto bg-slate-50 dark:bg-[#0f172a]">
          <div className="mb-5 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
            <p className="text-[13px] font-bold text-blue-900 dark:text-blue-300 line-clamp-2">{task.title}</p>
            <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-1 font-medium">Người thực hiện: {task.assignee?.full_name || 'Không có'}</p>
          </div>

          <form id="evalForm" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Điểm đánh giá (0-100)</label>
              <input 
                type="number" 
                min="0" max="100" 
                value={score} 
                onChange={(e) => setScore(e.target.value)}
                readOnly={!canEvaluate}
                required
                className={`w-full px-4 py-3 rounded-xl border font-bold text-[16px] outline-none transition-all ${
                  !canEvaluate ? 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 text-blue-600 dark:text-blue-400'
                }`}
                placeholder="Nhập điểm..."
              />
            </div>

            {score !== '' && currentRank && (
              <div>
                <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Xếp loại tự động</label>
                <div className={`px-4 py-3 rounded-xl border font-bold text-[14px] flex items-center gap-2 ${
                  currentRank === 'Xuất sắc' ? 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/50 dark:text-purple-400' :
                  currentRank === 'Tốt' ? 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400' :
                  currentRank === 'Hoàn thành' ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400' :
                  'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400'
                }`}>
                  <Star size={18} />
                  {currentRank}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">0-49: Không hoàn thành | 50-69: Hoàn thành | 70-89: Tốt | 90-100: Xuất sắc</p>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Nhận xét đánh giá</label>
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                readOnly={!canEvaluate}
                rows="4"
                placeholder={canEvaluate ? "Nhập nhận xét chi tiết..." : "Không có nhận xét."}
                className={`w-full px-4 py-3 rounded-xl border text-[14px] outline-none transition-all resize-none ${
                  !canEvaluate ? 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200'
                }`}
              ></textarea>
            </div>
            
            {!canEvaluate && isEvaluated && task.evaluated_at && (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 italic mt-2 font-medium">
                Đánh giá lúc: {new Date(task.evaluated_at).toLocaleString('vi-VN')}
              </p>
            )}
          </form>
        </div>

        <div className="px-4 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] sm:rounded-b-2xl flex justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none justify-center px-5 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 rounded-xl transition-colors">Đóng</button>
          {canEvaluate && (
            <button type="submit" form="evalForm" disabled={loading} className="flex-1 sm:flex-none justify-center px-5 py-2.5 font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.3)]">
              {loading ? 'Đang lưu...' : 'Lưu đánh giá'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

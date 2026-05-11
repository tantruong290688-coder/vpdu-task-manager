import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Star, User, Users, CheckCircle2, AlertTriangle, Send, History, Info, Clock, Save, FileText, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { taskEvaluationService } from '../services/taskEvaluationService';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { createNotification } from '../hooks/useNotifications';
import { canSelfProposeEvaluation, canMainAssigneeReview, canAdminFinalizeEvaluation, isTaskStillPendingFinalEvaluation } from '../lib/permissions';
import { calculateFinalScore } from '../utils/performanceScoring';

const PROGRESS_LEVELS = [
  { id: 'level1', label: 'Dưới 50%', score: 40, range: [0, 49] },
  { id: 'level2', label: '50% - dưới 70%', score: 60, range: [50, 69] },
  { id: 'level3', label: '70% - dưới 90%', score: 80, range: [70, 89] },
  { id: 'level4', label: '90% - dưới 100%', score: 95, range: [90, 99] },
  { id: 'level5', label: 'Hoàn thành (100%)', score: 100, range: [100, 100] }
];

const getLevelFromProgress = (progress) => {
  return PROGRESS_LEVELS.find(l => progress >= l.range[0] && progress <= l.range[1])?.label || PROGRESS_LEVELS[0].label;
};

const getScoreFromLevel = (levelLabel) => {
  return PROGRESS_LEVELS.find(l => l.label === levelLabel)?.score || 0;
};

export default function EvaluationModal({ isOpen, onClose, task, onEvaluated }) {
  const { profile } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [activeTab, setActiveTab] = useState('self'); // 'self' | 'review' | 'finalize'
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  // --- Form States: Self Evaluation ---
  const [selfScore, setSelfScore] = useState('');
  const [selfComment, setSelfComment] = useState('');
  const [selfLevel, setSelfLevel] = useState('Đạt yêu cầu');
  const [selfProgress, setSelfProgress] = useState('');
  const [selfWorkDone, setSelfWorkDone] = useState('');
  const [selfDifficulty, setSelfDifficulty] = useState('');
  const [selfQualityScore, setSelfQualityScore] = useState(80);
  const [selfProgressScore, setSelfProgressScore] = useState(80);
  const [selfCompletionRate, setSelfCompletionRate] = useState(100);

  // --- Form States: Main Assignee Review ---
  const [selectedCollabId, setSelectedCollabId] = useState(null);
  const [mainRevScore, setMainRevScore] = useState('');
  const [mainRevComment, setMainRevComment] = useState('');
  const [mainRevLevel, setMainRevLevel] = useState('Đạt yêu cầu');
  const [mainRevProgress, setMainRevProgress] = useState('');
  const [mainRevDiffReason, setMainRevDiffReason] = useState('');
  const [mainRevQualityScore, setMainRevQualityScore] = useState(80);
  const [mainRevProgressScore, setMainRevProgressScore] = useState(80);
  const [mainRevCompletionRate, setMainRevCompletionRate] = useState(100);
  const [mainRevDifficultyScore, setMainRevDifficultyScore] = useState(80);
  const [mainRevBonusPoint, setMainRevBonusPoint] = useState(0);
  const [mainRevPenaltyPoint, setMainRevPenaltyPoint] = useState(0);

  // --- Form States: Admin Finalization ---
  const [finalScore, setFinalScore] = useState('');
  const [finalComment, setFinalComment] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [finalProgress, setFinalProgress] = useState('');
  const [finalQualityScore, setFinalQualityScore] = useState(80);
  const [finalProgressScore, setFinalProgressScore] = useState(80);
  const [finalCompletionRate, setFinalCompletionRate] = useState(100);
  const [finalDifficultyScore, setFinalDifficultyScore] = useState(80);
  const [finalBonusPoint, setFinalBonusPoint] = useState(0);
  const [finalPenaltyPoint, setFinalPenaltyPoint] = useState(0);

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const isMainAssignee = profile?.id === task?.assignee_id;
  const isCollab = (task?.task_collaborators || []).some(c => c.user_id === profile?.id);

  const collaborators = task?.task_collaborators || [];
  const currentMyEval = evaluations.find(e => e.evaluated_user_id === profile?.id);

  useEffect(() => {
    if (isOpen && task) {
      fetchEvaluations();
      // Set default tab based on role
      if (isAdmin) setActiveTab('finalize');
      else if (isMainAssignee) setActiveTab('review');
      else setActiveTab('self');

      // Pre-select progress level
      const autoLevel = getLevelFromProgress(task.progress || 0);
      setSelfProgress(autoLevel);
      setMainRevProgress(autoLevel);
      setFinalProgress(autoLevel);
    }
  }, [isOpen, task]);

  const fetchEvaluations = async () => {
    setFetchLoading(true);
    try {
      const data = await taskEvaluationService.getByTaskId(task.id);
      setEvaluations(data);
      
      const myEval = data.find(e => e.evaluated_user_id === profile?.id);
      if (myEval) {
        setSelfScore(myEval.self_score || '');
        setSelfComment(myEval.self_comment || '');
        setSelfLevel(myEval.self_participation_level || 'Đạt yêu cầu');
        setSelfProgress(myEval.self_progress_level || getLevelFromProgress(task.progress || 0));
        setSelfQualityScore(myEval.self_quality_score || 80);
        setSelfProgressScore(myEval.self_progress_score || 80);
        setSelfCompletionRate(myEval.self_completion_rate || 100);
      }
    } catch (err) {
      console.error('Lỗi tải đánh giá:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  // 1. Gửi tự đề xuất điểm
  const handleSelfPropose = async (e) => {
    e.preventDefault();
    if (!canSelfProposeEvaluation(profile, task)) return;

    const scoreVal = parseInt(selfScore);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      toast.error('Vui lòng nhập điểm hợp lệ (0-100)');
      return;
    }

    setLoading(true);
    try {
      await taskEvaluationService.submitSelfEvaluation({
        taskId: task.id,
        userId: profile.id,
        score: scoreVal,
        comment: selfComment,
        participationLevel: selfLevel,
        progressLevel: selfProgress,
        qualityScore: selfQualityScore,
        progressScore: selfProgressScore,
        completionRate: selfCompletionRate
      });

      toast.success('Đã gửi tự đề xuất đánh giá');
      fetchEvaluations();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Người thực hiện chính đánh giá cho người phối hợp
  const handleMainAssigneeReview = async (evalId, collabSelfScore) => {
    const scoreVal = parseInt(mainRevScore);
    if (isNaN(scoreVal)) {
      toast.error('Vui lòng nhập điểm đánh giá');
      return;
    }

    // Yêu cầu lý do nếu chênh lệch trên 10 điểm
    if (Math.abs(scoreVal - (collabSelfScore || 0)) >= 10 && !mainRevDiffReason) {
      toast.error('Chênh lệch trên 10 điểm, vui lòng nhập lý do');
      return;
    }

    setLoading(true);
    try {
      await taskEvaluationService.submitMainAssigneeReview({
        evaluationId: evalId,
        score: scoreVal,
        comment: mainRevComment + (mainRevDiffReason ? `\n(Lý do chênh lệch: ${mainRevDiffReason})` : ''),
        participationLevel: mainRevLevel,
        progressLevel: mainRevProgress,
        reviewedBy: profile.id,
        qualityScore: mainRevQualityScore,
        progressScore: mainRevProgressScore,
        completionRate: mainRevCompletionRate,
        difficultyScore: mainRevDifficultyScore,
        bonusPoint: mainRevBonusPoint,
        penaltyPoint: mainRevPenaltyPoint
      });

      toast.success('Đã lưu đánh giá cho cộng sự');
      setSelectedCollabId(null);
      setMainRevScore('');
      setMainRevComment('');
      setMainRevDiffReason('');
      fetchEvaluations();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Admin chốt điểm
  const handleAdminFinalize = async (evalId, userId, role, proposedScore, selectedProgressLevel, currentFinalScore, newScore, newComment, newReason, q, c, d, b, p) => {
    const scoreVal = parseInt(newScore || finalScore);
    if (isNaN(scoreVal)) {
      toast.error('Vui lòng nhập điểm cuối cùng');
      return;
    }

    const commentVal = newComment !== undefined ? newComment : finalComment;
    const reasonVal = newReason !== undefined ? newReason : adjReason;

    if (proposedScore > 0 && scoreVal !== proposedScore && !reasonVal) {
      toast.error('Vui lòng nhập lý do điều chỉnh điểm');
      return;
    }

    // Capture granular values from params if provided (from AdminRow)
    const gQuality = q !== undefined ? q : finalQualityScore;
    const gCompletion = c !== undefined ? c : finalCompletionRate;
    const gDifficulty = d !== undefined ? d : finalDifficultyScore;
    const gBonus = b !== undefined ? b : finalBonusPoint;
    const gPenalty = p !== undefined ? p : finalPenaltyPoint;

    const progLevel = selectedProgressLevel || finalProgress;

    setLoading(true);
    try {
      const result = await taskEvaluationService.finalizeByAdmin({
        evaluationId: evalId,
        userId: userId,
        role: role,
        score: scoreVal,
        comment: commentVal,
        adjustmentReason: reasonVal,
        progressLevel: progLevel,
        progressScore: getScoreFromLevel(progLevel),
        finalizedBy: profile.id,
        oldScore: currentFinalScore,
        taskId: task.id,
        adjustedByName: profile.full_name,
        qualityScore: gQuality,
        completionRate: gCompletion,
        difficultyScore: gDifficulty,
        bonusPoint: gBonus,
        penaltyPoint: gPenalty
      });

      const actualEvalId = evalId || result.id;

      toast.success('Đã chốt đánh giá. Nhiệm vụ đã được lưu vào hồ sơ hoàn thành.');
      
      const { data: latestEvals } = await supabase.from('task_evaluations').select('*').eq('task_id', task.id);
      
      const isEverythingDone = !isTaskStillPendingFinalEvaluation(task, latestEvals || []);
      
      if (isEverythingDone) {
        // Tìm bản ghi đánh giá của người thực hiện chính để lấy điểm chốt chính thức của nhiệm vụ
        const mainEval = (latestEvals || []).find(e => e.evaluated_user_id === task.assignee_id);
        if (mainEval) {
          await supabase.from('tasks').update({
            evaluation_score: mainEval.final_score,
            evaluation_comment: mainEval.final_comment,
            evaluated_by: profile.id,
            evaluated_at: new Date().toISOString()
          }).eq('id', task.id);
        }
      }

      setFinalScore('');
      setFinalComment('');
      setAdjReason('');
      fetchEvaluations();
      onEvaluated();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-[#0f172a] w-full sm:max-w-4xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[40px] border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                 <Star size={28} fill="currentColor" />
              </div>
              <div>
                 <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-none">Hệ thống Đánh giá Đa cấp</h2>
                 <p className="text-[12px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                   <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600">{task.code}</span>
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                   <span>VPĐU TRÀ BỒNG</span>
                 </p>
              </div>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 rounded-2xl text-slate-400 transition-all">
              <X size={24} />
           </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-4 py-2 bg-slate-50/50 dark:bg-slate-900/20 gap-2 border-b border-slate-100 dark:border-slate-800">
           <button 
             onClick={() => setActiveTab('self')}
             className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-[24px] text-[13px] font-black transition-all ${
               activeTab === 'self' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xl shadow-slate-200/50 dark:shadow-none translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'
             }`}
           >
             <User size={18} />
             <span>Tự Đề Xuất</span>
           </button>
           
           {(isAdmin || isMainAssignee) && (
             <button 
               onClick={() => setActiveTab('review')}
               className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-[24px] text-[13px] font-black transition-all ${
                 activeTab === 'review' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xl shadow-slate-200/50 dark:shadow-none translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               <Users size={18} />
               <span>Đánh Giá Cộng Sự</span>
             </button>
           )}

           {(isAdmin || isManager) && (
             <button 
               onClick={() => setActiveTab('finalize')}
               className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-[24px] text-[13px] font-black transition-all ${
                 activeTab === 'finalize' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-xl shadow-slate-200/50 dark:shadow-none translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               <CheckCircle2 size={18} />
               <span>Phê Duyệt Cuối</span>
             </button>
           )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-[#0f172a]">
           {fetchLoading ? (
             <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Đang tải dữ liệu...</p>
             </div>
           ) : (
             <div className="p-8">
                {activeTab === 'self' && (
                  <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                     {/* Info Section */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-start gap-5 mb-8">
                           <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 shadow-inner">
                              <User size={32} />
                           </div>
                           <div>
                              <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-1">Cán bộ thực hiện</p>
                              <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{profile.full_name}</h3>
                              <p className="text-[14px] text-slate-500 font-medium mt-1">{task.title}</p>
                           </div>
                        </div>

                        {currentMyEval?.status === 'finalized' ? (
                           <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 p-8 rounded-[32px] text-center">
                              <CheckCircle2 size={48} className="text-emerald-600 mx-auto mb-4" />
                              <h4 className="text-xl font-black text-emerald-800 dark:text-emerald-400 mb-2">Đã Chốt Điểm Chính Thức</h4>
                              <p className="text-[14px] text-emerald-700/70 dark:text-emerald-500/70 font-bold mb-6">Lãnh đạo đã phê duyệt kết quả đánh giá cho bạn.</p>
                              <div className="inline-flex items-center gap-3 px-8 py-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-100">
                                 <span className="text-4xl font-black text-emerald-600">{currentMyEval.final_score}</span>
                                 <div className="w-px h-10 bg-emerald-100 mx-2" />
                                 <span className="text-[13px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-left leading-tight">Điểm<br/>Xếp Loại</span>
                              </div>
                           </div>
                        ) : currentMyEval?.status === 'self_submitted' ? (
                           <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-8 rounded-[32px] text-center">
                              <Clock size={48} className="text-amber-500 mx-auto mb-4" />
                              <h4 className="text-lg font-black text-amber-800 dark:text-amber-400">Đã Gửi Đề Xuất</h4>
                              <p className="text-[14px] text-amber-700/70 dark:text-amber-500/70 font-bold mt-2">Dữ liệu của bạn đang chờ Người thực hiện chính hoặc Lãnh đạo xét duyệt.</p>
                              <div className="mt-8 pt-8 border-t border-amber-100/50 flex flex-col gap-4 text-left">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-black text-amber-700/50 uppercase">Điểm tự đề xuất:</span>
                                    <span className="text-xl font-black text-amber-600">{currentMyEval.self_score}</span>
                                 </div>
                                 <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-2xl text-[13px] text-slate-600 italic">
                                    "{currentMyEval.self_comment}"
                                 </div>
                              </div>
                           </div>
                        ) : (
                           <form onSubmit={handleSelfPropose} className="space-y-8">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                 <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Chất lượng (40%)</label>
                                    <input 
                                      type="number" min="0" max="100"
                                      value={selfQualityScore} onChange={e => {
                                        const val = Number(e.target.value);
                                        setSelfQualityScore(val);
                                        setSelfScore(calculateFinalScore({ qualityScore: val, progressScore: selfProgressScore, completionRate: selfCompletionRate }));
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xl font-black text-indigo-600 outline-none"
                                    />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tiến độ (25%)</label>
                                    <input 
                                      type="number" min="0" max="100"
                                      value={selfProgressScore} onChange={e => {
                                        const val = Number(e.target.value);
                                        setSelfProgressScore(val);
                                        setSelfScore(calculateFinalScore({ qualityScore: selfQualityScore, progressScore: val, completionRate: selfCompletionRate }));
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xl font-black text-indigo-600 outline-none"
                                    />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ hoàn thành (20%)</label>
                                    <input 
                                      type="number" min="0" max="100"
                                      value={selfCompletionRate} onChange={e => {
                                        const val = Number(e.target.value);
                                        setSelfCompletionRate(val);
                                        setSelfScore(calculateFinalScore({ qualityScore: selfQualityScore, progressScore: selfProgressScore, completionRate: val }));
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xl font-black text-indigo-600 outline-none"
                                    />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mức độ tham gia</label>
                                    <select 
                                      value={selfLevel} onChange={e => setSelfLevel(e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-[14px] font-black text-slate-700 dark:text-slate-200 outline-none"
                                    >
                                       <option>Tích cực</option>
                                       <option>Đạt yêu cầu</option>
                                       <option>Phối hợp chưa thường xuyên</option>
                                       <option>Ít tham gia</option>
                                       <option>Không tham gia</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tiến độ tổng thể</label>
                                    <select 
                                      value={selfProgress} onChange={e => setSelfProgress(e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-[14px] font-black text-slate-700 dark:text-slate-200 outline-none"
                                    >
                                       {PROGRESS_LEVELS.map(l => (
                                         <option key={l.id} value={l.label}>{l.label}</option>
                                       ))}
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Điểm đề xuất (Tổng)</label>
                                    <div className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 rounded-2xl text-2xl font-black text-indigo-600 flex items-center justify-center">
                                       {selfScore || 0}
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-3">
                                 <label className="flex items-center gap-2 text-[12px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                                    <MessageSquare size={14} className="text-indigo-500" />
                                    <span>Nội dung thực hiện & Tự nhận xét</span>
                                 </label>
                                 <textarea 
                                   rows="5" required
                                   value={selfComment} onChange={e => setSelfComment(e.target.value)}
                                   placeholder="Mô tả tóm tắt kết quả phần việc bạn đảm nhận và tự đánh giá ưu/khuyết điểm..."
                                   className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-5 rounded-[32px] text-[15px] font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none leading-relaxed"
                                 />
                              </div>

                              <button 
                                type="submit" disabled={loading}
                                className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[32px] text-lg font-black shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                              >
                                 {loading ? 'Đang xử lý...' : (
                                   <>
                                     <Send size={20} />
                                     <span>Gửi Đề Xuất Đánh Giá</span>
                                   </>
                                 )}
                              </button>
                           </form>
                        )}
                     </div>
                  </div>
                )}

                {activeTab === 'review' && (
                  <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-500">
                     <div className="flex items-center justify-between mb-2">
                        <div>
                           <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-[0.2em]">Cấp độ 2: Người thực hiện chính</h4>
                           <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">Đánh giá Cộng sự phối hợp</h2>
                        </div>
                        <div className="text-right">
                           <p className="text-[11px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-1.5 rounded-full inline-block">MANAGER REVIEW</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* List of Collaborators */}
                        <div className="lg:col-span-5 space-y-4">
                           {collaborators.length === 0 ? (
                              <div className="p-12 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 text-center">
                                 <Users size={32} className="text-slate-200 mx-auto mb-4" />
                                 <p className="text-[14px] font-bold text-slate-400">Không có người phối hợp</p>
                              </div>
                           ) : (
                              collaborators.map(c => {
                                 const cId = c.profiles?.id || c.user_id;
                                 const ev = evaluations.find(e => e.evaluated_user_id === cId);
                                 const isSelected = selectedCollabId === cId;
                                 
                                 return (
                                    <div 
                                      key={cId}
                                      onClick={() => setSelectedCollabId(isSelected ? null : cId)}
                                      className={`p-5 rounded-[32px] border cursor-pointer transition-all flex items-center justify-between group ${
                                        isSelected 
                                          ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-600/20' 
                                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-300'
                                      }`}
                                    >
                                       <div className="flex items-center gap-4">
                                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-600'
                                          }`}>
                                             <User size={22} />
                                          </div>
                                          <div>
                                             <p className={`text-[15px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                                                {c.profiles?.full_name}
                                             </p>
                                             <div className="mt-2 flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                                                  ev?.status === 'finalized' ? 'bg-emerald-400/20 text-emerald-400' :
                                                  ev?.status === 'main_reviewed' ? 'bg-blue-400/20 text-blue-400' :
                                                  ev?.status === 'self_submitted' ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-400/20 text-slate-400'
                                                }`}>
                                                   {ev?.status === 'finalized' ? 'Đã chốt' :
                                                    ev?.status === 'main_reviewed' ? 'Đã ĐG' :
                                                    ev?.status === 'self_submitted' ? 'Đã đề xuất' : 'Chờ đề xuất'}
                                                </span>
                                                {ev?.main_assignee_score && (
                                                   <span className={`text-[11px] font-black ${isSelected ? 'text-white/70' : 'text-indigo-600'}`}>
                                                      {ev.main_assignee_score}đ
                                                   </span>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                       <ChevronRight size={20} className={isSelected ? 'text-white' : 'text-slate-300'} />
                                    </div>
                                 );
                              })
                           )}
                        </div>

                        {/* Evaluation Form for Selected Collab */}
                        <div className="lg:col-span-7">
                           {!selectedCollabId ? (
                              <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-100/50 dark:bg-slate-900/30 rounded-[48px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                 <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 mb-6">
                                    <Users size={40} />
                                 </div>
                                 <p className="text-lg font-black text-slate-400">Chọn cộng sự để bắt đầu đánh giá</p>
                                 <p className="text-[13px] text-slate-400 mt-2">Dữ liệu đánh giá của bạn sẽ là cơ sở để Admin chốt điểm chính thức.</p>
                              </div>
                           ) : (() => {
                              const selCollab = collaborators.find(c => (c.profiles?.id || c.user_id) === selectedCollabId);
                              const selEval = evaluations.find(e => e.evaluated_user_id === selectedCollabId);
                              
                              return (
                                 <div className="bg-white dark:bg-slate-900 p-8 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8 animate-in fade-in zoom-in-95 duration-300">
                                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-6">
                                       <div className="flex items-center gap-4">
                                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                                             <User size={28} />
                                          </div>
                                          <div>
                                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang đánh giá cho</p>
                                             <h4 className="text-xl font-black text-slate-800 dark:text-white mt-1">{selCollab.profiles?.full_name}</h4>
                                          </div>
                                       </div>
                                       {selEval?.status === 'main_reviewed' && (
                                          <span className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl text-[11px] font-black uppercase">Đã lưu đề xuất</span>
                                       )}
                                    </div>

                                    {/* Show Self Proposal If Exists */}
                                    {selEval?.status === 'self_submitted' || selEval?.status === 'main_reviewed' || selEval?.status === 'finalized' ? (
                                       <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                                          <div className="flex justify-between items-center mb-4">
                                             <h5 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Tự đánh giá của cộng sự</h5>
                                             <span className="text-2xl font-black text-indigo-600">{selEval.self_score}đ</span>
                                          </div>
                                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 text-[13px] text-slate-600 dark:text-slate-300 font-bold italic leading-relaxed">
                                             "{selEval.self_comment}"
                                          </div>
                                          <div className="mt-4 flex items-center gap-2">
                                             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mức độ tham gia:</span>
                                             <span className="text-[12px] font-black text-indigo-800 dark:text-indigo-400">{selEval.self_participation_level}</span>
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-3xl text-center">
                                          <AlertCircle size={24} className="text-amber-500 mx-auto mb-2" />
                                          <p className="text-[13px] font-black text-amber-700">Cộng sự chưa gửi tự đề xuất điểm.</p>
                                          <p className="text-[12px] text-amber-600 mt-1">Bạn có thể chủ động đánh giá dựa trên quá trình phối hợp thực tế.</p>
                                       </div>
                                    )}

                                    {/* Evaluation Form */}
                                    {selEval?.status === 'finalized' ? (
                                       <div className="p-8 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-[32px] text-center">
                                          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-3" />
                                          <h5 className="text-lg font-black text-emerald-800 dark:text-emerald-400">Đã Chốt Kết Quả</h5>
                                          <div className="mt-4 text-3xl font-black text-emerald-600">{selEval.final_score}đ</div>
                                       </div>
                                    ) : (
                                       <div className="space-y-6">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chất lượng (40%)</label>
                                                <input 
                                                  type="number" value={mainRevQualityScore} onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMainRevQualityScore(val);
                                                    setMainRevScore(calculateFinalScore({ 
                                                      qualityScore: val, progressScore: mainRevProgressScore, completionRate: mainRevCompletionRate, 
                                                      difficultyScore: mainRevDifficultyScore, bonusPoint: mainRevBonusPoint, penaltyPoint: mainRevPenaltyPoint 
                                                    }));
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-lg font-black text-indigo-600 outline-none"
                                                />
                                             </div>
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ (25%)</label>
                                                <input 
                                                  type="number" value={mainRevProgressScore} onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMainRevProgressScore(val);
                                                    setMainRevScore(calculateFinalScore({ 
                                                      qualityScore: mainRevQualityScore, progressScore: val, completionRate: mainRevCompletionRate, 
                                                      difficultyScore: mainRevDifficultyScore, bonusPoint: mainRevBonusPoint, penaltyPoint: mainRevPenaltyPoint 
                                                    }));
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-lg font-black text-indigo-600 outline-none"
                                                />
                                             </div>
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ HT (20%)</label>
                                                <input 
                                                  type="number" value={mainRevCompletionRate} onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMainRevCompletionRate(val);
                                                    setMainRevScore(calculateFinalScore({ 
                                                      qualityScore: mainRevQualityScore, progressScore: mainRevProgressScore, completionRate: val, 
                                                      difficultyScore: mainRevDifficultyScore, bonusPoint: mainRevBonusPoint, penaltyPoint: mainRevPenaltyPoint 
                                                    }));
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-lg font-black text-indigo-600 outline-none"
                                                />
                                             </div>
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khối lượng (15%)</label>
                                                <input 
                                                  type="number" value={mainRevDifficultyScore} onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMainRevDifficultyScore(val);
                                                    setMainRevScore(calculateFinalScore({ 
                                                      qualityScore: mainRevQualityScore, progressScore: mainRevProgressScore, completionRate: mainRevCompletionRate, 
                                                      difficultyScore: val, bonusPoint: mainRevBonusPoint, penaltyPoint: mainRevPenaltyPoint 
                                                    }));
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-lg font-black text-indigo-600 outline-none"
                                                />
                                             </div>
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm cộng</label>
                                                <input 
                                                  type="number" value={mainRevBonusPoint} onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMainRevBonusPoint(val);
                                                    setMainRevScore(calculateFinalScore({ 
                                                      qualityScore: mainRevQualityScore, progressScore: mainRevProgressScore, completionRate: mainRevCompletionRate, 
                                                      difficultyScore: mainRevDifficultyScore, bonusPoint: val, penaltyPoint: mainRevPenaltyPoint 
                                                    }));
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-lg font-black text-emerald-600 outline-none"
                                                />
                                             </div>
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm trừ</label>
                                                <input 
                                                  type="number" value={mainRevPenaltyPoint} onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMainRevPenaltyPoint(val);
                                                    setMainRevScore(calculateFinalScore({ 
                                                      qualityScore: mainRevQualityScore, progressScore: mainRevProgressScore, completionRate: mainRevCompletionRate, 
                                                      difficultyScore: mainRevDifficultyScore, bonusPoint: mainRevBonusPoint, penaltyPoint: val 
                                                    }));
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-lg font-black text-rose-600 outline-none"
                                                />
                                             </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-4">
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mức độ tham gia</label>
                                                <select 
                                                  value={mainRevLevel} onChange={e => setMainRevLevel(e.target.value)}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-[13px] font-black outline-none"
                                                >
                                                   <option>Tích cực</option>
                                                   <option>Đạt yêu cầu</option>
                                                   <option>Phối hợp chưa thường xuyên</option>
                                                   <option>Ít tham gia</option>
                                                </select>
                                             </div>
                                             <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ tổng thể</label>
                                                <select 
                                                  value={mainRevProgress} onChange={e => setMainRevProgress(e.target.value)}
                                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-[13px] font-black outline-none"
                                                >
                                                   {PROGRESS_LEVELS.map(l => (
                                                     <option key={l.id} value={l.label}>{l.label}</option>
                                                   ))}
                                                </select>
                                             </div>
                                          </div>

                                          <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                             <span className="text-[13px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest">Tổng điểm đề xuất</span>
                                             <span className="text-3xl font-black text-indigo-600">{mainRevScore}đ</span>
                                          </div>

                                          {/* Logic check for >10pt difference */}
                                          {Math.abs(parseInt(mainRevScore) - (selEval?.self_score || 0)) >= 10 && (
                                             <div className="space-y-2 animate-in slide-in-from-top-2">
                                                <label className="text-[11px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                                   <AlertTriangle size={12} />
                                                   <span>Lý do chênh lệch {'>'}10 điểm (Bắt buộc)</span>
                                                </label>
                                                <input 
                                                  type="text" value={mainRevDiffReason} onChange={e => setMainRevDiffReason(e.target.value)}
                                                  className="w-full bg-rose-50/30 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 px-5 py-3 rounded-2xl text-[13px] font-bold text-rose-600 outline-none"
                                                  placeholder="Tại sao bạn chấm khác nhiều so với cộng sự?"
                                                />
                                             </div>
                                          )}

                                          <div className="space-y-2">
                                             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Nhận xét chi tiết</label>
                                             <textarea 
                                               rows="3" value={mainRevComment} onChange={e => setMainRevComment(e.target.value)}
                                               className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-4 rounded-3xl text-[13px] font-bold outline-none resize-none"
                                               placeholder="Ghi chú về tinh thần phối hợp, chất lượng phần việc..."
                                             />
                                          </div>

                                          <button 
                                            onClick={() => handleMainAssigneeReview(selEval?.id, selEval?.self_score)}
                                            disabled={loading || !mainRevScore}
                                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[28px] text-[15px] font-black shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                          >
                                             <Save size={18} />
                                             <span>Lưu Đánh Giá Cộng Sự</span>
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              );
                           })()}
                        </div>
                     </div>
                  </div>
                )}

                {activeTab === 'finalize' && (
                  <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                     <div className="flex items-center justify-between">
                        <div>
                           <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-[0.2em]">Cấp độ 3: Admin / Lãnh đạo</h4>
                           <h2 className="text-3xl font-black text-slate-800 dark:text-white mt-1">Phê Duyệt Kết Quả Cuối Cùng</h2>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase">Trạng thái chung</p>
                              <p className="text-[14px] font-black text-amber-600 uppercase tracking-tighter">Đang xét duyệt</p>
                           </div>
                           <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                              <CheckCircle2 size={24} />
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 gap-6">
                        {/* Summary Table for Admin */}
                        <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="bg-slate-50 dark:bg-slate-800/50">
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Thành viên</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Vai trò</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Tự Đề Xuất</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Người Chính ĐG</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Điểm Chốt</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                 {/* Main Assignee Row */}
                                 <AdminRow 
                                   user={task.assignee} 
                                   roleLabel="Chính" 
                                   roleType="main_assignee"
                                   roleCls="text-indigo-600 bg-indigo-50"
                                   evaluation={evaluations.find(e => e.evaluated_user_id === task.assignee_id)}
                                   onFinalize={handleAdminFinalize}
                                   loading={loading}
                                 />
                                 
                                 {/* Collaborator Rows */}
                                 {collaborators.map(c => (
                                    <AdminRow 
                                      key={c.profiles?.id || c.user_id}
                                      user={c.profiles} 
                                      roleLabel="Phối hợp" 
                                      roleType="collaborator"
                                      roleCls="text-blue-600 bg-blue-50"
                                      evaluation={evaluations.find(e => e.evaluated_user_id === (c.profiles?.id || c.user_id))}
                                      onFinalize={handleAdminFinalize}
                                      loading={loading}
                                    />
                                 ))}
                              </tbody>
                           </table>
                        </div>

                        {/* Audit Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[32px] border border-indigo-100 dark:border-indigo-800/30">
                              <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-2">Tổng quan tiến độ</h5>
                              <div className="flex items-end gap-2">
                                 <span className="text-3xl font-black text-indigo-700">{evaluations.filter(e => e.status === 'finalized').length}</span>
                                 <span className="text-lg font-bold text-indigo-400 mb-1">/ {collaborators.length + 1}</span>
                              </div>
                              <p className="text-[12px] text-indigo-700/60 font-bold mt-1">Người đã được chốt điểm</p>
                           </div>
                           <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] border border-slate-200 dark:border-slate-800 col-span-2">
                              <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Ghi chú lưu ý cho Admin</h5>
                              <div className="flex items-start gap-3">
                                 <Info size={18} className="text-indigo-500 mt-0.5" />
                                 <p className="text-[13px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                    Điểm cuối cùng chỉ được ghi nhận chính thức sau khi bạn nhấn "Chốt". Nếu thay đổi điểm so với đề xuất, hãy nhập lý do điều chỉnh để lưu vào lịch sử hệ thống.
                                 </p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] flex items-center justify-between">
           <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 italic">
              <AlertCircle size={14} />
              <span>Dữ liệu được bảo mật và lưu vết lịch sử</span>
           </div>
           <button 
             onClick={onClose} 
             className="px-10 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-black rounded-2xl transition-all text-[13px] uppercase tracking-widest"
           >
              Đóng
           </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Sub-component for Admin Table Row
 */
function AdminRow({ user, roleLabel, roleType, roleCls, evaluation, onFinalize, loading }) {
   const [score, setScore] = useState('');
   const [reason, setReason] = useState('');
   const [comment, setComment] = useState('');
   const [progressLevel, setProgressLevel] = useState('');
   const [isEditing, setIsEditing] = useState(false);
   const [qualityScore, setQualityScore] = useState(80);
   const [completionRate, setCompletionRate] = useState(100);
   const [difficultyScore, setDifficultyScore] = useState(80);
   const [bonusPoint, setBonusPoint] = useState(0);
   const [penaltyPoint, setPenaltyPoint] = useState(0);

   useEffect(() => {
     if (evaluation) {
       setScore(evaluation.final_score || evaluation.main_assignee_score || evaluation.self_score || '');
       setComment(evaluation.final_comment || '');
       setReason(evaluation.final_adjustment_reason || '');
       setProgressLevel(evaluation.final_progress_level || evaluation.main_assignee_progress_level || evaluation.self_progress_level || '');
       setQualityScore(evaluation.final_quality_score || evaluation.main_reviewer_quality_score || evaluation.self_quality_score || 80);
       setCompletionRate(evaluation.final_completion_rate || evaluation.main_reviewer_completion_rate || evaluation.self_completion_rate || 100);
       setDifficultyScore(evaluation.final_difficulty_score || evaluation.main_reviewer_difficulty_score || 80);
       setBonusPoint(evaluation.final_bonus_point || evaluation.main_reviewer_bonus_point || 0);
       setPenaltyPoint(evaluation.final_penalty_point || evaluation.main_reviewer_penalty_point || 0);
     }
   }, [evaluation]);

   if (!user) return null;

   const proposedScore = evaluation?.main_assignee_score || evaluation?.self_score || 0;

   const updateLiveScore = (q, c, d, b, p, prog) => {
     const s = calculateFinalScore({
       qualityScore: q,
       progressScore: getScoreFromLevel(prog),
       completionRate: c,
       difficultyScore: d,
       bonusPoint: b,
       penaltyPoint: p
     });
     setScore(s);
   };

   return (
      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
         <td className="px-8 py-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <User size={18} />
               </div>
               <span className="text-[14px] font-black text-slate-800 dark:text-white">{user.full_name}</span>
            </div>
         </td>
         <td className="px-6 py-6">
            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${roleCls} bg-opacity-20`}>{roleLabel}</span>
         </td>
         <td className="px-6 py-6">
            <div className="flex flex-col">
               <span className="text-[14px] font-black text-slate-600 dark:text-slate-400">{evaluation?.self_score ? `${evaluation.self_score}đ` : '—'}</span>
                {evaluation?.self_participation_level && (
                  <span className="text-[10px] font-bold text-slate-400 mt-1">{evaluation.self_participation_level}</span>
               )}
               {evaluation?.self_progress_level && (
                  <span className="text-[10px] font-black text-emerald-600 mt-0.5">{evaluation.self_progress_level}</span>
               )}
            </div>
         </td>
         <td className="px-6 py-6">
            <div className="flex flex-col">
               <span className="text-[14px] font-black text-indigo-600">{evaluation?.main_assignee_score ? `${evaluation.main_assignee_score}đ` : '—'}</span>
                {evaluation?.main_assignee_comment && (
                  <span className="text-[10px] font-bold text-slate-400 mt-1 truncate max-w-[150px] italic">"{evaluation.main_assignee_comment}"</span>
               )}
               {evaluation?.main_assignee_progress_level && (
                  <span className="text-[10px] font-black text-indigo-50 mt-0.5">{evaluation.main_assignee_progress_level}</span>
               )}
            </div>
         </td>
         <td className="px-6 py-6">
            {(evaluation?.status === 'finalized' && !isEditing) ? (
                <div className="flex flex-col">
                   <div className="flex items-center gap-2">
                      <span className="text-[16px] font-black text-emerald-600">{evaluation.final_score}đ</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase">Đã chốt</span>
                   </div>
                   {evaluation.final_adjustment_reason && (
                      <span className="text-[10px] font-medium text-rose-500 mt-1 italic leading-tight truncate max-w-[150px]" title={evaluation.final_adjustment_reason}>
                        Lý do: {evaluation.final_adjustment_reason}
                      </span>
                   )}
                   <span className="text-[10px] font-black text-emerald-500 mt-1">{evaluation.final_progress_level || '—'}</span>
                </div>
            ) : isEditing ? (
               <div className="space-y-4 w-64 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
                  <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Chất lượng</label>
                        <input type="number" value={qualityScore} onChange={e => { setQualityScore(Number(e.target.value)); updateLiveScore(Number(e.target.value), completionRate, difficultyScore, bonusPoint, penaltyPoint, progressLevel); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-[13px] font-black" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Hoàn thành</label>
                        <input type="number" value={completionRate} onChange={e => { setCompletionRate(Number(e.target.value)); updateLiveScore(qualityScore, Number(e.target.value), difficultyScore, bonusPoint, penaltyPoint, progressLevel); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-[13px] font-black" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Độ khó</label>
                        <input type="number" value={difficultyScore} onChange={e => { setDifficultyScore(Number(e.target.value)); updateLiveScore(qualityScore, completionRate, Number(e.target.value), bonusPoint, penaltyPoint, progressLevel); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-[13px] font-black" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Tiến độ</label>
                        <select value={progressLevel} onChange={e => { setProgressLevel(e.target.value); updateLiveScore(qualityScore, completionRate, difficultyScore, bonusPoint, penaltyPoint, e.target.value); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1 py-1 rounded text-[11px] font-black">
                           {PROGRESS_LEVELS.map(l => <option key={l.id} value={l.label}>{l.label}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase text-emerald-500">Thưởng</label>
                        <input type="number" value={bonusPoint} onChange={e => { setBonusPoint(Number(e.target.value)); updateLiveScore(qualityScore, completionRate, difficultyScore, Number(e.target.value), penaltyPoint, progressLevel); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-[13px] font-black text-emerald-600" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase text-rose-500">Phạt</label>
                        <input type="number" value={penaltyPoint} onChange={e => { setPenaltyPoint(Number(e.target.value)); updateLiveScore(qualityScore, completionRate, difficultyScore, bonusPoint, Number(e.target.value), progressLevel); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-[13px] font-black text-rose-600" />
                     </div>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100">
                     <span className="text-[10px] font-black uppercase text-indigo-600">Tổng chốt</span>
                     <span className="text-lg font-black text-indigo-700">{score}đ</span>
                  </div>

                  {parseInt(score) !== proposedScore && (
                     <input 
                       type="text" value={reason} onChange={e => setReason(e.target.value)}
                       className="w-full bg-rose-50/50 border border-rose-100 px-3 py-2 rounded-xl text-[11px] font-bold text-rose-600 outline-none"
                       placeholder="Lý do điều chỉnh"
                     />
                  )}
                  <textarea 
                    value={comment} onChange={e => setComment(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 px-3 py-2 rounded-xl text-[11px] font-medium outline-none resize-none"
                    placeholder="Nhận xét chốt..."
                    rows="2"
                  />
                  <div className="flex gap-2">
                     <button 
                       onClick={() => onFinalize(evaluation?.id, user.id, roleType, proposedScore, progressLevel, evaluation?.final_score, score, comment, reason, qualityScore, completionRate, difficultyScore, bonusPoint, penaltyPoint).then(() => setIsEditing(false))}
                       className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-black"
                     >Lưu</button>
                     <button 
                       onClick={() => setIsEditing(false)}
                       className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-[11px] font-black"
                     >Hủy</button>
                  </div>
               </div>
            ) : (
               <span className="text-[14px] font-black text-slate-300">Chưa chốt</span>
            )}
         </td>
         <td className="px-8 py-6 text-right">
            {!isEditing && evaluation?.status !== 'finalized' && evaluation?.status !== 'pending' && (
               <button 
                 onClick={() => setIsEditing(true)}
                 className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-[11px] font-black transition-all"
               >
                 CHỐT ĐIỂM
               </button>
            )}
            {evaluation?.status === 'finalized' && !isEditing && (
               <button 
                 onClick={() => setIsEditing(true)}
                 className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-600 hover:text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1 ml-auto"
               >
                 <History size={14} />
                 ĐIỀU CHỈNH
               </button>
            )}
         </td>
      </tr>
   );
}

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Star, User, Users, CheckCircle2, AlertTriangle, Send, History, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { taskEvaluationService } from '../services/taskEvaluationService';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { createNotification } from '../hooks/useNotifications';

export default function EvaluationModal({ isOpen, onClose, task, onEvaluated }) {
  const { profile } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'collaborators'
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  // Form states for Main Assignee
  const [mainScore, setMainScore] = useState('');
  const [mainComment, setMainComment] = useState('');

  // Form states for Collaborator Proposal
  const [selectedCollabId, setSelectedCollabId] = useState(null);
  const [propScore, setPropScore] = useState('');
  const [propComment, setPropComment] = useState('');
  const [propLevel, setPropLevel] = useState('Đạt yêu cầu');

  // Form states for Final Review
  const [finalScore, setFinalScore] = useState('');
  const [finalComment, setFinalComment] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const isLeader = isAdmin || isManager;
  const isMainAssignee = profile?.id === task?.assignee_id;

  const collaborators = task?.task_collaborators || [];

  useEffect(() => {
    if (isOpen && task) {
      fetchEvaluations();
    }
  }, [isOpen, task]);

  const fetchEvaluations = async () => {
    setFetchLoading(true);
    try {
      const data = await taskEvaluationService.getByTaskId(task.id);
      setEvaluations(data);
      
      const mainEval = data.find(e => e.evaluated_role === 'main_assignee');
      if (mainEval) {
        setMainScore(mainEval.final_score || '');
        setMainComment(mainEval.final_comment || '');
      } else {
        setMainScore(task.evaluation_score || '');
        setMainComment(task.evaluation_comment || '');
      }
    } catch (err) {
      console.error('Lỗi tải đánh giá:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleEvaluateMain = async (e) => {
    e.preventDefault();
    if (!isLeader) return;
    
    setLoading(true);
    try {
      await taskEvaluationService.evaluateMainAssignee({
        taskId: task.id,
        userId: task.assignee_id,
        score: parseInt(mainScore),
        comment: mainComment,
        reviewedBy: profile.id
      });

      // Update legacy fields for compatibility
      await supabase.from('tasks').update({
        evaluation_score: parseInt(mainScore),
        evaluation_comment: mainComment,
        evaluated_by: profile.id,
        evaluated_at: new Date().toISOString()
      }).eq('id', task.id);

      toast.success('Đã lưu đánh giá người thực hiện chính');
      fetchEvaluations();
      onEvaluated();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeCollab = async (collabId) => {
    setLoading(true);
    try {
      await taskEvaluationService.upsertProposal({
        taskId: task.id,
        userId: collabId,
        role: 'collaborator',
        proposedBy: profile.id,
        score: parseInt(propScore),
        comment: propComment,
        participationLevel: propLevel
      });

      toast.success('Đã gửi đề xuất đánh giá');
      setSelectedCollabId(null);
      setPropScore('');
      setPropComment('');
      fetchEvaluations();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeCollab = async (evalId, pScore) => {
    if (parseInt(finalScore) !== pScore && !adjReason) {
      toast.error('Vui lòng nhập lý do điều chỉnh điểm');
      return;
    }

    setLoading(true);
    try {
      await taskEvaluationService.finalizeEvaluation({
        evaluationId: evalId,
        score: parseInt(finalScore),
        comment: finalComment,
        adjustmentReason: adjReason,
        reviewedBy: profile.id
      });

      toast.success('Đã chốt đánh giá người phối hợp');
      setSelectedCollabId(null);
      setFinalScore('');
      setFinalComment('');
      setAdjReason('');
      fetchEvaluations();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-[#111827] w-full sm:max-w-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl border border-transparent dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">Trung tâm Đánh giá</h2>
              <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{task.code}</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
              <X size={20} />
           </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1 border-b border-slate-100 dark:border-slate-800">
           <button 
             onClick={() => setActiveTab('main')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-black transition-all ${
               activeTab === 'main' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
             }`}
           >
             <User size={16} />
             <span>Người thực hiện chính</span>
           </button>
           <button 
             onClick={() => setActiveTab('collaborators')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-black transition-all ${
               activeTab === 'collaborators' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
             }`}
           >
             <Users size={16} />
             <span>Người phối hợp ({collaborators.length})</span>
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#111827]">
           {fetchLoading ? (
             <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
             </div>
           ) : (
             <>
               {activeTab === 'main' && (
                 <div className="space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-800/30 flex items-start gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-600 shadow-sm">
                          <User size={24} />
                       </div>
                       <div>
                          <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Người thực hiện chính</p>
                          <p className="text-lg font-black text-slate-800 dark:text-white leading-none mt-1">{task.assignee?.full_name}</p>
                          <p className="text-[13px] text-indigo-800/70 dark:text-indigo-400/70 font-medium mt-2">{task.title}</p>
                       </div>
                    </div>

                    {isLeader ? (
                      <form onSubmit={handleEvaluateMain} className="space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                               <label className="block text-[13px] font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide">Điểm đánh giá (0-100)</label>
                               <input 
                                 type="number" min="0" max="100" required
                                 value={mainScore} onChange={e => setMainScore(e.target.value)}
                                 className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-4 rounded-3xl text-2xl font-black text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                               />
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center">
                               <div className="flex flex-col">
                                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Xếp loại gợi ý</span>
                                  <span className={`text-sm font-black mt-1 ${
                                    parseInt(mainScore) >= 90 ? 'text-emerald-600' :
                                    parseInt(mainScore) >= 70 ? 'text-blue-600' :
                                    parseInt(mainScore) >= 50 ? 'text-amber-600' : 'text-rose-600'
                                  }`}>
                                    {parseInt(mainScore) >= 90 ? 'Hoàn thành xuất sắc' :
                                     parseInt(mainScore) >= 70 ? 'Hoàn thành tốt' :
                                     parseInt(mainScore) >= 50 ? 'Hoàn thành' : 'Chưa hoàn thành'}
                                  </span>
                               </div>
                            </div>
                         </div>

                         <div>
                            <label className="block text-[13px] font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide">Nhận xét chi tiết</label>
                            <textarea 
                              rows="4" required
                              value={mainComment} onChange={e => setMainComment(e.target.value)}
                              placeholder="Nhập nhận xét về kết quả, tiến độ và tinh thần trách nhiệm..."
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-4 rounded-3xl text-[14px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                            />
                         </div>

                         <div className="flex justify-end">
                            <button 
                              type="submit" disabled={loading}
                              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] text-[14px] font-black shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                               {loading ? 'Đang lưu...' : (
                                 <>
                                   <CheckCircle2 size={18} />
                                   <span>Chốt đánh giá</span>
                                 </>
                               )}
                            </button>
                         </div>
                      </form>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                         <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[13px] font-black text-slate-500 uppercase tracking-widest">Kết quả đánh giá</h4>
                            <span className="text-[11px] font-bold text-slate-400 italic">Chỉ dành cho Lãnh đạo</span>
                         </div>
                         {mainScore ? (
                           <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                 <div className="text-4xl font-black text-indigo-600">{mainScore}</div>
                                 <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                                 <div>
                                    <p className="text-[14px] font-black text-slate-800 dark:text-white uppercase tracking-tight">
                                       {parseInt(mainScore) >= 90 ? 'Hoàn thành xuất sắc' :
                                        parseInt(mainScore) >= 70 ? 'Hoàn thành tốt' :
                                        parseInt(mainScore) >= 50 ? 'Hoàn thành' : 'Chưa hoàn thành'}
                                    </p>
                                    <p className="text-[12px] text-slate-500 font-medium">Điểm đánh giá hệ thống</p>
                                 </div>
                              </div>
                              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-[14px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                 "{mainComment}"
                              </div>
                           </div>
                         ) : (
                           <div className="flex flex-col items-center py-6 text-slate-400 italic">
                              <AlertTriangle size={24} className="mb-2 opacity-30" />
                              <p className="text-[13px]">Nhiệm vụ này chưa được lãnh đạo đánh giá chính thức.</p>
                           </div>
                         )}
                      </div>
                    )}
                 </div>
               )}

               {activeTab === 'collaborators' && (
                 <div className="space-y-4">
                    {collaborators.length === 0 ? (
                      <div className="flex flex-col items-center py-20 text-slate-400">
                         <Users size={40} className="mb-4 opacity-20" />
                         <p className="text-[14px] font-bold">Nhiệm vụ này không có người phối hợp.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                         {collaborators.map(c => {
                           const collabId = c.profiles?.id || c.user_id;
                           const evalData = evaluations.find(e => e.evaluated_user_id === collabId);
                           const isSelected = selectedCollabId === collabId;

                           return (
                             <div key={collabId} className={`border rounded-[32px] overflow-hidden transition-all ${
                               isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'
                             }`}>
                                <div 
                                  onClick={() => setSelectedCollabId(isSelected ? null : collabId)}
                                  className="px-6 py-4 flex items-center justify-between cursor-pointer group"
                                >
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
                                         <User size={20} />
                                      </div>
                                      <div>
                                         <p className="text-[14px] font-black text-slate-800 dark:text-white leading-none">{c.profiles?.full_name}</p>
                                         <div className="flex items-center gap-2 mt-1.5">
                                            {evalData ? (
                                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                evalData.status === 'finalized' ? 'bg-emerald-100 text-emerald-600' :
                                                evalData.status === 'waiting_final_review' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                                              }`}>
                                                {evalData.status === 'finalized' ? 'Đã đánh giá' : 'Chờ chốt'}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-400">Chưa đề xuất</span>
                                            )}
                                            {evalData?.final_score && <span className="text-[11px] font-black text-indigo-600">Điểm: {evalData.final_score}</span>}
                                         </div>
                                      </div>
                                   </div>
                                   <History size={16} className="text-slate-300" />
                                </div>

                                {isSelected && (
                                  <div className="px-6 pb-6 pt-2 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                                     {/* Proposal Form (For Main Assignee) */}
                                     {isMainAssignee && (!evalData || evalData.status === 'pending') && (
                                       <div className="space-y-4">
                                          <div className="flex items-center gap-2 mb-2">
                                             <Send size={14} className="text-indigo-600" />
                                             <h5 className="text-[12px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Đề xuất đánh giá</h5>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                <label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase">Điểm đề xuất</label>
                                                <input 
                                                  type="number" value={propScore} onChange={e => setPropScore(e.target.value)}
                                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 px-4 py-2.5 rounded-2xl font-black text-indigo-600 outline-none"
                                                />
                                             </div>
                                             <div>
                                                <label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase">Mức độ tham gia</label>
                                                <select value={propLevel} onChange={e => setPropLevel(e.target.value)}
                                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 px-4 py-2.5 rounded-2xl font-bold text-[13px] outline-none">
                                                   <option>Tích cực</option>
                                                   <option>Đạt yêu cầu</option>
                                                   <option>Phối hợp chưa thường xuyên</option>
                                                   <option>Ít tham gia</option>
                                                </select>
                                             </div>
                                          </div>
                                          <textarea 
                                            rows="3" value={propComment} onChange={e => setPropComment(e.target.value)}
                                            placeholder="Nhận xét lý do đề xuất mức điểm này..."
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 px-4 py-3 rounded-2xl text-[13px] font-bold outline-none resize-none"
                                          />
                                          <button 
                                            onClick={() => handleProposeCollab(collabId)}
                                            disabled={loading || !propScore}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-[13px] font-black shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                          >
                                            Gửi đề xuất cho Lãnh đạo
                                          </button>
                                       </div>
                                     )}

                                     {/* Review Form (For Leaders) */}
                                     {isLeader && evalData?.status === 'waiting_final_review' && (
                                       <div className="space-y-4">
                                          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-4">
                                             <div className="flex justify-between mb-2">
                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Đề xuất từ {task.assignee?.full_name}</span>
                                                <span className="text-[13px] font-black text-indigo-600">{evalData.proposed_score} điểm</span>
                                             </div>
                                             <p className="text-[13px] text-slate-600 dark:text-slate-300 font-bold italic">"{evalData.proposed_comment}"</p>
                                          </div>
                                          
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             <div>
                                                <label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase">Điểm chính thức</label>
                                                <input 
                                                  type="number" value={finalScore} onChange={e => setFinalScore(e.target.value)}
                                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 px-4 py-2.5 rounded-2xl font-black text-indigo-600 outline-none"
                                                />
                                             </div>
                                             {parseInt(finalScore) !== evalData.proposed_score && (
                                               <div>
                                                  <label className="block text-[11px] font-black text-rose-500 mb-1.5 uppercase">Lý do điều chỉnh</label>
                                                  <input 
                                                    type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)}
                                                    placeholder="Tại sao thay đổi điểm?"
                                                    className="w-full bg-white dark:bg-slate-800 border border-rose-200 px-4 py-2.5 rounded-2xl font-bold text-[13px] text-rose-600 outline-none"
                                                  />
                                               </div>
                                             )}
                                          </div>
                                          <textarea 
                                            rows="2" value={finalComment} onChange={e => setFinalComment(e.target.value)}
                                            placeholder="Nhận xét chốt cuối của lãnh đạo..."
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 px-4 py-3 rounded-2xl text-[13px] font-bold outline-none resize-none"
                                          />
                                          <button 
                                            onClick={() => handleFinalizeCollab(evalData.id, evalData.proposed_score)}
                                            disabled={loading || !finalScore}
                                            className="w-full py-3 bg-emerald-600 text-white rounded-2xl text-[13px] font-black shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                          >
                                            Chốt đánh giá cuối cùng
                                          </button>
                                       </div>
                                     )}

                                     {/* View Only (For others or if finalized) */}
                                     {evalData?.status === 'finalized' && (
                                       <div className="space-y-4">
                                          <div className="flex items-center justify-between">
                                             <div className="flex items-center gap-2">
                                                <div className="text-3xl font-black text-emerald-600">{evalData.final_score}</div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Điểm<br/>Cuối</div>
                                             </div>
                                             <div className="text-right">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Đề xuất: {evalData.proposed_score}</p>
                                                {evalData.final_adjustment_reason && (
                                                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">Đã điều chỉnh từ đề xuất</p>
                                                )}
                                             </div>
                                          </div>
                                          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-[13px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                             {evalData.final_comment || 'Không có nhận xét chốt.'}
                                          </div>
                                       </div>
                                     )}

                                     {/* Waiting State */}
                                     {evalData?.status === 'waiting_final_review' && !isLeader && (
                                       <div className="flex flex-col items-center py-4 text-amber-500 italic">
                                          <Clock size={20} className="mb-2 opacity-50" />
                                          <p className="text-[12px] font-bold text-center">Đề xuất đang chờ Lãnh đạo xét duyệt cuối cùng.</p>
                                       </div>
                                     )}

                                     {(!evalData || evalData.status === 'pending') && !isMainAssignee && (
                                       <div className="flex flex-col items-center py-4 text-slate-400 italic">
                                          <AlertTriangle size={20} className="mb-2 opacity-30" />
                                          <p className="text-[12px] font-bold text-center">Đang chờ Người thực hiện chính gửi đề xuất.</p>
                                       </div>
                                     )}
                                  </div>
                                )}
                             </div>
                           );
                         })}
                      </div>
                    )}
                 </div>
               )}
             </>
           )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
           <button onClick={onClose} className="px-6 py-2.5 font-black text-slate-500 hover:text-slate-700 transition-colors text-[13px] uppercase tracking-widest">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function Clock(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

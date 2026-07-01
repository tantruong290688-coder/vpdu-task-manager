import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { parseKpiPlanDocx } from '../services/kpiPlanService';
import toast from 'react-hot-toast';

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Hook quản lý Kế hoạch KPI quý của 1 cán bộ.
 * - Đọc danh sách kế hoạch
 * - Import từ file .docx (parse client-side rồi lưu)
 * - Xóa kế hoạch
 */
export function useKpiPlan(staffId) {
  const queryClient = useQueryClient();
  const queryKey = ['kpi-plans', staffId];

  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState(null); // kết quả parse trước khi lưu

  const { data: plansData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!staffId) return { plans: [] };
      const token = await getToken();
      const res = await fetch(`/api/kpi?module=plan&action=get-plans&staffId=${staffId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    enabled: !!staffId,
    staleTime: 30_000,
  });

  // Parse file .docx (chưa lưu) → trả về preview
  const parseFile = useCallback(async (file) => {
    setIsImporting(true);
    try {
      const plan = await parseKpiPlanDocx(file);
      if (!plan.year || !plan.quarter) {
        toast.error('Không nhận diện được Quý/Năm trong file. Kiểm tra tiêu đề "QUÝ .../...".');
      }
      // [TẠM THỜI] Bỏ chặn < Quý III/2026 để test luồng nhập với file Quý II.
      setPreview(plan);
      return plan;
    } catch (e) {
      toast.error('Lỗi đọc file: ' + e.message);
      throw e;
    } finally {
      setIsImporting(false);
    }
  }, []);

  // Lưu kế hoạch đã preview
  const savePlan = useCallback(async (plan, staffName) => {
    setIsImporting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/kpi?module=plan&action=save-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ staffId, staffName, plan }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Đã lưu Kế hoạch ${data.periodLabel || ''} (${data.savedTasks} nhiệm vụ)`);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey });
      return data;
    } catch (e) {
      toast.error('Lưu thất bại: ' + e.message);
      throw e;
    } finally {
      setIsImporting(false);
    }
  }, [staffId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải 1 kế hoạch kèm danh mục nhiệm vụ (để xuất Word)
  const loadPlanTasks = useCallback(async (planId) => {
    const token = await getToken();
    const res = await fetch(`/api/kpi?module=plan&action=get-plan&planId=${planId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data; // { plan, tasks }
  }, []);

  const deletePlan = useCallback(async (planId) => {
    const token = await getToken();
    const res = await fetch(`/api/kpi?module=plan&action=delete-plan&planId=${planId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) { toast.error(data.error); return; }
    toast.success('Đã xóa kế hoạch');
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    plans: plansData?.plans || [],
    isLoading,
    isImporting,
    preview,
    setPreview,
    parseFile,
    savePlan,
    deletePlan,
    loadPlanTasks,
  };
}

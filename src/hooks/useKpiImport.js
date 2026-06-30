import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  parseExcelFile,
  parsePdfFile,
  normalizeDocumentRows,
  detectStaffRoleInDocument,
  mergeDocumentDataWithTasks,
  analyzeStaffPerformanceWithAI,
} from '../services/kpiDocumentService';
import toast from 'react-hot-toast';

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Hook quản lý toàn bộ luồng: Upload → Parse → Normalize → Detect Roles → AI Analysis
 *
 * @param {string} staffId     – ID cán bộ đang xem
 * @param {object} staffConfig – { id, full_name, aliases, is_reviewer, role }
 */
export function useKpiImport(staffId, staffConfig) {
  const queryClient = useQueryClient();
  const queryKey = ['kpi-batches', staffId];

  // Trạng thái tiến trình
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [error, setError] = useState(null);
  const [currentBatchId, setCurrentBatchId] = useState(null);

  // Fetch danh sách batch của cán bộ
  const { data: batchesData, isLoading: isFetchingBatches } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!staffId) return { batches: [] };
      const token = await getToken();
      const response = await fetch(
        `/api/kpi?module=import&action=get-batches&staffId=${staffId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    enabled: !!staffId,
    staleTime: 30_000,
  });

  const batches = batchesData?.batches || [];
  const latestBatch = batches[0] || null;
  const latestAnalysis = latestBatch?.kpi_ai_analysis_results?.[0] || null;

  // ──────────────────────────────────────────────────────
  // uploadFiles: upload + parse + detect roles + lưu DB
  // Dùng presigned URL: browser upload thẳng lên MinIO, không qua Vercel
  // ──────────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files, { periodLabel, allStaff = [], tasks = [] } = {}) => {
    if (!files?.length) return;
    setError(null);
    setIsUploading(true);

    const token = await getToken();
    if (!token) {
      setIsUploading(false);
      toast.error('Phiên đăng nhập hết hạn');
      return;
    }

    try {
      // 1. Xin presigned PUT URLs từ server (chỉ gửi metadata, không gửi file)
      const prepResp = await fetch('/api/kpi?module=import&action=prepare-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          staffId,
          staffName: staffConfig.full_name,
          periodLabel: periodLabel || null,
          files: Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })),
        }),
      });

      const prepData = await prepResp.json();
      if (!prepData.success) throw new Error(prepData.error || 'Không thể chuẩn bị upload');

      const batchId = prepData.batchId;
      setCurrentBatchId(batchId);

      // 2. Upload từng file thẳng lên MinIO qua presigned URL (không qua Vercel)
      const confirmedFiles = [];
      for (const fileMeta of prepData.files) {
        const file = Array.from(files).find(f => f.name === fileMeta.name);
        if (!file || !fileMeta.uploadUrl) {
          confirmedFiles.push({ fileId: fileMeta.fileId, success: false, error: 'Không có URL upload' });
          continue;
        }
        try {
          const putResp = await fetch(fileMeta.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': fileMeta.contentType || file.type || 'application/octet-stream' },
            body: file,
          });
          if (!putResp.ok) throw new Error(`HTTP ${putResp.status}`);
          confirmedFiles.push({ fileId: fileMeta.fileId, success: true });
        } catch (putErr) {
          confirmedFiles.push({ fileId: fileMeta.fileId, success: false, error: putErr.message });
        }
      }

      // 3. Thông báo server về kết quả upload
      await fetch('/api/kpi?module=import&action=confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ batchId, confirmedFiles }),
      });

      const successFiles = prepData.files.filter(f => confirmedFiles.find(c => c.fileId === f.fileId && c.success));

      setIsUploading(false);
      setIsParsing(true);

      if (successFiles.length === 0) {
        toast.error('Không có file nào upload thành công');
        setIsParsing(false);
        return;
      }

      // 4. Parse từng file ở frontend
      let allDocuments = [];
      let allStaffRoles = [];
      let fileParseResults = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadedMeta = successFiles.find(f => f.name === file.name);
        if (!uploadedMeta) continue;

        setParseProgress({ current: i + 1, total: files.length, fileName: file.name });

        let rows = [];
        let parseStatus = 'success';
        let scanWarning = false;

        try {
          const ext = file.name.split('.').pop().toLowerCase();

          if (ext === 'pdf') {
            const { pages, isScanWarning, structuredRows } = await parsePdfFile(file);
            scanWarning = isScanWarning;
            if (isScanWarning) {
              parseStatus = 'scan_warning';
              toast(`⚠️ File "${file.name}" có thể là PDF ảnh/scan, dữ liệu trích xuất có thể không chính xác`, { icon: '⚠️' });
            }
            if (structuredRows && structuredRows.length > 0) {
              // PDF bảng: dùng kết quả parse theo tọa độ (chính xác hơn)
              rows = structuredRows;
            } else {
              // Fallback: parse text dạng "Key: Value"
              rows = parsePdfTextToRows(pages.join('\n'));
            }
          } else {
            const { rows: excelRows } = await parseExcelFile(file);
            rows = excelRows;
          }
        } catch (parseErr) {
          parseStatus = 'failed';
          fileParseResults.push({
            fileId: uploadedMeta.fileId,
            name: file.name,
            error: parseErr.message,
          });
          toast.error(`Không đọc được file "${file.name}": ${parseErr.message}`);
          continue;
        }

        // 3. Chuẩn hóa
        const normalizedDocs = normalizeDocumentRows(rows);

        // 4. Detect roles
        const docBaseIndex = allDocuments.length;
        const roles = normalizedDocs.map((doc, docIdx) => {
          const result = detectStaffRoleInDocument(doc, staffConfig, allStaff);
          return {
            doc_index: docBaseIndex + docIdx,
            staff_id: staffConfig.id,
            staff_name: staffConfig.full_name,
            ...result,
          };
        });

        allDocuments = allDocuments.concat(normalizedDocs);
        allStaffRoles = allStaffRoles.concat(roles);

        fileParseResults.push({
          fileId: uploadedMeta.fileId,
          name: file.name,
          parseStatus,
          docsCount: normalizedDocs.length,
        });
      }

      // 5. Lưu documents + roles vào DB
      // Truyền kèm fileParseResults để server cập nhật rows_parsed và parse_status cho từng file
      if (allDocuments.length > 0 || fileParseResults.length > 0) {
        const saveResp = await fetch(`/api/kpi?module=import&action=save-documents&batchId=${batchId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            documents: allDocuments,
            staffRoles: allStaffRoles,
            fileParseResults: fileParseResults.map(fp => ({
              fileId: fp.fileId,
              docsCount: fp.docsCount,
              parseStatus: fp.parseStatus,
            })),
          }),
        });

        const saveData = await saveResp.json();
        if (!saveData.success) {
          toast.error('Lưu dữ liệu văn bản thất bại: ' + saveData.error);
        }
      }

      setIsParsing(false);
      await queryClient.invalidateQueries({ queryKey });

      const totalDocs = allDocuments.length;
      const directAdvisor = allStaffRoles.filter(r => r.role_type === 'direct_advisor').length;
      const reviewer = allStaffRoles.filter(r => r.role_type === 'reviewer').length;

      toast.success(
        `Đã nhập ${totalDocs} văn bản từ ${successFiles.length} file. ` +
        `Trực tiếp tham mưu: ${directAdvisor}, Thẩm định: ${reviewer}`
      );

      return { batchId, totalDocs, directAdvisor, reviewer };

    } catch (globalErr) {
      setIsUploading(false);
      setIsParsing(false);
      setError(globalErr.message);
      toast.error('Lỗi: ' + globalErr.message);
    }
  }, [staffId, staffConfig, queryClient, queryKey]);

  // ──────────────────────────────────────────────────────
  // runAiAnalysis: chạy AI phân tích cho 1 batch
  // ──────────────────────────────────────────────────────
  const runAiAnalysis = useCallback(async (batchId, tasks = []) => {
    const targetBatchId = batchId || currentBatchId || latestBatch?.id;
    if (!targetBatchId) {
      toast.error('Chưa có đợt nhập dữ liệu');
      return;
    }

    setError(null);
    setIsAnalyzing(true);

    try {
      const token = await getToken();

      // Lấy documents của batch
      const docsResp = await fetch(
        `/api/kpi?module=import&action=get-documents&batchId=${targetBatchId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const docsData = await docsResp.json();
      if (!docsData.success) throw new Error(docsData.error);

      const documents = docsData.documents || [];

      // Tính stats
      const { documentStats, taskStats, mergedDocs, mergedTasks } =
        mergeDocumentDataWithTasks(
          documents.map(d => ({
            ...d,
            role_type: d.kpi_document_staff_roles?.[0]?.role_type || 'unrelated',
          })),
          tasks,
          staffId
        );

      // Gọi AI
      const result = await analyzeStaffPerformanceWithAI({
        batchId: targetBatchId,
        staffData: {
          id: staffConfig.id,
          full_name: staffConfig.full_name,
          role: staffConfig.role,
          period_label: latestBatch?.period_label || '',
        },
        documentStats,
        taskStats,
        documents: mergedDocs,
        tasks: mergedTasks,
      });

      await queryClient.invalidateQueries({ queryKey });
      toast.success('AI đã hoàn tất phân tích KPI!');
      return result;

    } catch (analysisErr) {
      setError(analysisErr.message);
      toast.error('Lỗi phân tích AI: ' + analysisErr.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentBatchId, latestBatch, staffId, staffConfig, queryClient, queryKey]);

  // ──────────────────────────────────────────────────────
  // deleteBatch: xóa 1 batch (có xác nhận từ UI)
  // ──────────────────────────────────────────────────────
  const deleteBatch = useCallback(async (batchId) => {
    const token = await getToken();
    const resp = await fetch(`/api/kpi?module=import&action=delete-batch&batchId=${batchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error);
    await queryClient.invalidateQueries({ queryKey });
    toast.success('Đã xóa đợt nhập và kết quả phân tích');
  }, [queryClient, queryKey]);

  return {
    // Data
    batches,
    latestBatch,
    latestAnalysis,
    currentBatchId,

    // Actions
    uploadFiles,
    runAiAnalysis,
    deleteBatch,

    // States
    isUploading,
    isParsing,
    isAnalyzing,
    isFetchingBatches,
    parseProgress,
    error,
  };
}

// ────────────────────────────────────────────────────────────
// Helper: chuyển text PDF dạng luồng thành rows có thể normalize
// ────────────────────────────────────────────────────────────
function parsePdfTextToRows(text) {
  if (!text?.trim()) return [];

  // Tách theo dòng và tìm các entry có số ký hiệu văn bản
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Thử detect bảng: tìm các dòng có ký tự phân cách
  const tableRows = [];
  let currentRow = {};

  for (const line of lines) {
    // Pattern: "Số ký hiệu: 123/..." hoặc "Ngày: ..."
    const colonMatch = line.match(/^([^:]{3,30})\s*:\s*(.+)$/);
    if (colonMatch) {
      const [, key, value] = colonMatch;
      currentRow[key.trim()] = value.trim();
    } else if (line.length > 10 && Object.keys(currentRow).length > 0) {
      // Dòng mới, lưu row hiện tại
      if (Object.keys(currentRow).length >= 2) {
        tableRows.push({ ...currentRow });
      }
      currentRow = {};
      // Thử dùng dòng này làm Trích yếu
      if (!currentRow['Trích yếu']) {
        currentRow = { 'Trích yếu': line };
      }
    }
  }

  if (Object.keys(currentRow).length >= 1) {
    tableRows.push({ ...currentRow });
  }

  // Fallback: nếu không detect được, tạo 1 row với toàn bộ text
  if (tableRows.length === 0 && text.length > 20) {
    return [{ 'Trích yếu': text.slice(0, 500), 'Ghi chú': 'Dữ liệu trích xuất từ PDF' }];
  }

  return tableRows;
}

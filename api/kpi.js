/**
 * API thống nhất cho tính năng KPI PDF/Excel
 * ?module=import  → upload/save/get/delete
 * ?module=analyze → AI KPI analysis
 *
 * Upload dùng presigned PUT URL: browser upload thẳng lên MinIO/R2,
 * không qua Vercel proxy → nhanh hơn nhiều.
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GoogleGenerativeAI } from '@google/generative-ai';

/* global process */

// ── S3 Client ──────────────────────────────────────────────
// Credentials PHẢI lấy từ biến môi trường — không hardcode secret mặc định.
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT_SERVER || 'http://localhost:9000',
  region: process.env.MINIO_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const ok  = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m)   => res.status(s).json({ success: false, error: m });

const ALLOWED_EXTENSIONS  = ['.pdf', '.xls', '.xlsx'];
const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.cmd', '.js', '.mjs', '.html', '.php', '.zip', '.rar', '.7z', '.sh', '.msi', '.ps1', '.vbs'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Auth helper ────────────────────────────────────────────
async function authenticate(req, supabaseUrl, anonKey, serviceKey) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: profile } = await adminClient.from('profiles').select('role, full_name').eq('id', user.id).single();
  return { user, profile, adminClient };
}

// ════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════
// bodyParser: true → Vercel auto-parses JSON; req.body available directly
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;
  const bucket      = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.MINIO_CHAT_BUCKET || 'message-attachments';

  if (!supabaseUrl || !anonKey) return err(res, 500, 'Thiếu cấu hình Supabase');

  const auth = await authenticate(req, supabaseUrl, anonKey, serviceKey);
  if (!auth) return err(res, 401, 'Không có quyền truy cập. Vui lòng đăng nhập.');

  const { user, profile, adminClient } = auth;
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';
  const { module: apiModule, action, batchId, staffId, planId, year, quarter } = req.query;

  try {
    // ══════════════════════════════════════════════════════
    // MODULE: analyze
    // ══════════════════════════════════════════════════════
    if (apiModule === 'analyze') {
      if (req.method !== 'POST') return err(res, 405, 'Method Not Allowed');
      if (!canEdit) return err(res, 403, 'Chỉ admin/quản lý được chạy phân tích KPI');

      const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
      if (!geminiApiKey) return err(res, 500, 'Chưa cấu hình Gemini API Key');

      const body = req.body || {};
      const { batchId: bid, staffData, documentStats, taskStats, documents, tasks } = body;
      if (!bid) return err(res, 400, 'Thiếu batchId');

      const staffName  = staffData?.full_name || staffData?.staff_name || 'Cán bộ';
      const staffRole  = staffData?.role || '';
      const periodLabel = staffData?.period_label || '';
      const docList    = Array.isArray(documents) ? documents.slice(0, 150) : [];
      const taskList   = Array.isArray(tasks) ? tasks.slice(0, 100) : [];

      const docSummaryText = docList.length > 0
        ? docList.slice(0, 80).map(d =>
            `- [${d.role_type_label || d.role_type}] ${d.document_number || '(chưa có số)'} ${d.document_date || ''}: ${d.summary || d.document_type || '(chưa có trích yếu)'} | Người trình: ${d.presenter_name || '-'} | Người ký: ${d.signer_name || '-'}`
          ).join('\n')
        : 'Không có dữ liệu văn bản.';

      const taskSummaryText = taskList.length > 0
        ? taskList.slice(0, 50).map(t =>
            `- [${t.role || 'Chủ trì'}] ${t.code || ''} "${t.title}": ${t.status || ''}, hạn ${t.due_date || '-'}, điểm ${t.score ?? 'chưa chốt'}`
          ).join('\n')
        : 'Không có dữ liệu nhiệm vụ.';

      const prompt = `
Bạn là chuyên gia nhân sự và cố vấn KPI cho lãnh đạo Văn phòng Đảng ủy.
Hãy phân tích và đánh giá hiệu suất công tác của cán bộ sau đây dựa trên dữ liệu văn bản và nhiệm vụ được cung cấp.

=== THÔNG TIN CÁN BỘ ===
Họ tên: ${staffName}
Chức vụ: ${staffRole}
Kỳ đánh giá: ${periodLabel}

=== THỐNG KÊ VĂN BẢN ===
- Tổng văn bản liên quan: ${documentStats?.total || docList.length}
- Trực tiếp tham mưu: ${documentStats?.direct_advisor || 0}
- Thẩm định văn bản: ${documentStats?.reviewer || 0}
- Phối hợp: ${documentStats?.collaborator || 0}

=== THỐNG KÊ NHIỆM VỤ ===
- Tổng nhiệm vụ: ${taskStats?.total || taskList.length}
- Đã hoàn thành: ${taskStats?.completed || 0}
- Đúng hạn: ${taskStats?.on_time || '-'}
- Quá hạn: ${taskStats?.overdue || '-'}
- Tỷ lệ hoàn thành: ${taskStats?.completion_rate || '-'}%

=== DANH SÁCH VĂN BẢN TIÊU BIỂU ===
${docSummaryText}

=== DANH SÁCH NHIỆM VỤ TIÊU BIỂU ===
${taskSummaryText}

=== YÊU CẦU ===
Trả về JSON thuần (không markdown fence):
{
  "analysis_summary": "Tóm tắt 2-4 câu ngắn gọn, văn phong hành chính",
  "strengths": "Ưu điểm (bullet markdown)",
  "limitations": "Hạn chế (hoặc 'Cần theo dõi thêm' nếu chưa đủ dữ liệu)",
  "kpi_evidence": [{"document_number":"...","document_date":"...","summary":"...","role_type":"...","role_label":"...","reason":"..."}],
  "suggested_comment": "Nhận xét văn phong hành chính Đảng. Cuối: '(Kết quả AI chỉ có giá trị tham khảo; việc xếp loại chính thức do cấp có thẩm quyền quyết định)'"
}
Tối đa 5 minh chứng KPI. KHÔNG tự xếp loại cán bộ.
      `.trim();

      const models   = ['gemini-3.1-flash-lite', 'gemini-3.1-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
      const genAI    = new GoogleGenerativeAI(geminiApiKey);
      let aiText     = null;
      let modelUsed  = null;
      let lastErr    = null;

      for (const m of models) {
        try {
          const mdl    = genAI.getGenerativeModel({ model: m, generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } });
          const result = await mdl.generateContent(prompt);
          aiText    = result.response.text();
          modelUsed = m;
          break;
        } catch (e) { lastErr = e; if (e.status && e.status !== 404) break; }
      }

      if (!aiText) return err(res, 500, 'AI phân tích thất bại: ' + (lastErr?.message || 'Unknown'));

      let aiResult = {};
      try {
        const m = aiText.match(/\{[\s\S]*\}/);
        aiResult = m ? JSON.parse(m[0]) : {};
      } catch (_) { aiResult = {}; }

      const resultPayload = {
        batch_id:             bid,
        staff_id:             staffData?.id || staffData?.staff_id || null,
        staff_name:           staffName,
        analysis_summary:     aiResult.analysis_summary || aiText,
        strengths:            aiResult.strengths || '',
        limitations:          aiResult.limitations || '',
        kpi_evidence:         aiResult.kpi_evidence || [],
        task_statistics:      taskStats || {},
        document_statistics:  documentStats || {},
        suggested_comment:    aiResult.suggested_comment || '',
        ai_model_used:        modelUsed,
      };

      const { data: existing } = await adminClient.from('kpi_ai_analysis_results').select('id').eq('batch_id', bid).single();
      if (existing) {
        await adminClient.from('kpi_ai_analysis_results').update(resultPayload).eq('id', existing.id);
      } else {
        await adminClient.from('kpi_ai_analysis_results').insert(resultPayload);
      }
      await adminClient.from('kpi_import_batches').update({ status: 'completed' }).eq('id', bid);
      await adminClient.from('activity_logs').insert({ actor_id: user.id, action: 'kpi_ai_analysis', metadata: { batch_id: bid, staff_name: staffName, model_used: modelUsed } }).then(null, () => {});

      return ok(res, { result: resultPayload, modelUsed });
    }

    // ══════════════════════════════════════════════════════
    // MODULE: plan  (Kế hoạch KPI quý — import từ .docx)
    // ══════════════════════════════════════════════════════
    if (apiModule === 'plan') {
      // GET: danh sách kế hoạch của 1 cán bộ
      if (req.method === 'GET' && action === 'get-plans') {
        if (!staffId) return err(res, 400, 'Thiếu staffId');
        const { data, error: e } = await adminClient
          .from('kpi_quarter_plans')
          .select('*, kpi_plan_tasks(count)')
          .eq('staff_id', staffId)
          .order('year', { ascending: false })
          .order('quarter', { ascending: false });
        if (e) return err(res, 500, e.message);
        return ok(res, { plans: data || [] });
      }

      // GET: 1 kế hoạch kèm nhiệm vụ
      if (req.method === 'GET' && action === 'get-plan') {
        let pid = planId;
        if (!pid && staffId && year && quarter) {
          const { data: p } = await adminClient.from('kpi_quarter_plans')
            .select('id').eq('staff_id', staffId).eq('year', year).eq('quarter', quarter).maybeSingle();
          pid = p?.id;
        }
        if (!pid) return ok(res, { plan: null, tasks: [] });
        const { data: plan } = await adminClient.from('kpi_quarter_plans').select('*').eq('id', pid).single();
        const { data: tasks } = await adminClient.from('kpi_plan_tasks').select('*').eq('plan_id', pid).order('row_index', { ascending: true });
        return ok(res, { plan, tasks: tasks || [] });
      }

      // POST: lưu kế hoạch đã parse từ .docx (upsert theo staff+year+quarter)
      if (req.method === 'POST' && action === 'save-plan') {
        if (!canEdit) return err(res, 403, 'Chỉ admin/quản lý được nhập Kế hoạch KPI');
        const body = req.body || {};
        const { staffId: sId, staffName: sName, plan } = body;
        if (!sId || !plan) return err(res, 400, 'Thiếu staffId hoặc dữ liệu kế hoạch');
        if (!plan.year || !plan.quarter) return err(res, 400, 'Không xác định được Quý/Năm từ file. Vui lòng kiểm tra tiêu đề file.');
        // [TẠM THỜI] Mở cho mọi quý để test luồng nhập. Khi chạy thật, bật lại chặn < Quý III/2026:
        // if (plan.year < 2026 || (plan.year === 2026 && plan.quarter < 3)) {
        //   return err(res, 400, 'Hệ thống chỉ áp dụng Kế hoạch KPI từ Quý III/2026 trở đi.');
        // }

        const planRow = {
          staff_id: sId,
          staff_name: sName || plan.full_name || '',
          full_name: plan.full_name || null,
          ngay_sinh: plan.ngay_sinh || null,
          chuc_vu_dang: plan.chuc_vu_dang || null,
          chuc_vu_chinh_quyen: plan.chuc_vu_chinh_quyen || null,
          chuc_vu_doan_the: plan.chuc_vu_doan_the || null,
          don_vi: plan.don_vi || null,
          year: plan.year,
          quarter: plan.quarter,
          period_label: plan.period_label || null,
          truc_config: plan.truc_config || [],
          approver_name: plan.approver_name || null,
          source_file: plan.fileName || null,
          created_by: user.id,
          status: 'draft',
        };

        const { data: existing } = await adminClient.from('kpi_quarter_plans')
          .select('id').eq('staff_id', sId).eq('year', plan.year).eq('quarter', plan.quarter).maybeSingle();

        let pid;
        if (existing) {
          await adminClient.from('kpi_quarter_plans').update(planRow).eq('id', existing.id);
          pid = existing.id;
          await adminClient.from('kpi_plan_tasks').delete().eq('plan_id', pid);
        } else {
          const { data: ins, error: e } = await adminClient.from('kpi_quarter_plans').insert(planRow).select('id').single();
          if (e) return err(res, 500, 'Không thể tạo kế hoạch: ' + e.message);
          pid = ins.id;
        }

        const rows = (plan.tasks || []).map(t => ({
          plan_id: pid, section: t.section || 'main', truc_no: t.truc_no ?? null, stt: t.stt ?? null,
          nhiem_vu: t.nhiem_vu || '', cap_trinh: t.cap_trinh || null, do_kho: t.do_kho || null,
          san_pham: t.san_pham || null, so_luong_kh: t.so_luong_kh || null, so_luong_so: t.so_luong_so ?? null,
          diem_cham_cong_viec: t.diem_cham_cong_viec ?? null, he_so_quy_doi: t.he_so_quy_doi ?? null,
          thoi_gian: t.thoi_gian || null, ghi_chu: t.ghi_chu || null, row_index: t.row_index ?? null,
        }));
        if (rows.length) {
          const { error: te } = await adminClient.from('kpi_plan_tasks').insert(rows);
          if (te) return err(res, 500, 'Lưu nhiệm vụ thất bại: ' + te.message);
        }

        await adminClient.from('activity_logs').insert({
          actor_id: user.id, action: 'kpi_plan_import',
          metadata: { plan_id: pid, staff_id: sId, period: plan.period_label, tasks: rows.length },
        }).then(null, () => {});

        return ok(res, { planId: pid, savedTasks: rows.length, periodLabel: plan.period_label });
      }

      // DELETE: xóa kế hoạch
      if (req.method === 'DELETE' && action === 'delete-plan') {
        if (!canEdit) return err(res, 403, 'Không có quyền xóa kế hoạch');
        if (!planId) return err(res, 400, 'Thiếu planId');
        const { error: e } = await adminClient.from('kpi_quarter_plans').delete().eq('id', planId);
        if (e) return err(res, 500, 'Xóa thất bại: ' + e.message);
        await adminClient.from('activity_logs').insert({ actor_id: user.id, action: 'kpi_plan_delete', metadata: { plan_id: planId } }).then(null, () => {});
        return ok(res, { message: 'Đã xóa kế hoạch KPI' });
      }

      return err(res, 404, 'Plan endpoint không tồn tại');
    }

    // ══════════════════════════════════════════════════════
    // MODULE: import
    // ══════════════════════════════════════════════════════

    // GET: get-batches
    if (req.method === 'GET' && action === 'get-batches') {
      if (!staffId) return err(res, 400, 'Thiếu staffId');
      const { data: batches, error: dbErr } = await adminClient
        .from('kpi_import_batches')
        .select('*, kpi_import_files (id, file_name, file_type, file_size, parse_status, parse_error, rows_parsed), kpi_ai_analysis_results (id, analysis_summary, strengths, limitations, kpi_evidence, task_statistics, document_statistics, suggested_comment, ai_model_used, created_at)')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false });
      if (dbErr) return err(res, 500, dbErr.message);
      return ok(res, { batches: batches || [] });
    }

    // GET: get-documents
    if (req.method === 'GET' && action === 'get-documents') {
      if (!batchId) return err(res, 400, 'Thiếu batchId');
      const { data: docs, error: dbErr } = await adminClient
        .from('kpi_documents')
        .select('*, kpi_document_staff_roles (*)')
        .eq('batch_id', batchId)
        .order('row_index', { ascending: true });
      if (dbErr) return err(res, 500, dbErr.message);
      return ok(res, { documents: docs || [] });
    }

    // POST: prepare-upload
    // Tạo batch + file records, trả về presigned PUT URLs để browser upload thẳng lên MinIO
    if (req.method === 'POST' && action === 'prepare-upload') {
      if (!canEdit) return err(res, 403, 'Chỉ admin/quản lý được nhập file KPI');

      const body = req.body || {};
      const { staffName: sName, staffId: sId, periodLabel, files: filesMeta } = body;

      const resolvedStaffId   = sId   || staffId;
      const resolvedStaffName = sName || '';

      if (!resolvedStaffId || !resolvedStaffName)  return err(res, 400, 'Thiếu staffId hoặc staffName');
      if (!Array.isArray(filesMeta) || !filesMeta.length) return err(res, 400, 'Không có file');

      // Validate metadata trước khi tạo batch
      const validFiles = filesMeta.filter(f => {
        const ext = ('.' + (f.name || '').split('.').pop()).toLowerCase();
        if (FORBIDDEN_EXTENSIONS.includes(ext)) return false;
        if (!ALLOWED_EXTENSIONS.includes(ext))  return false;
        if ((f.size || 0) > MAX_FILE_SIZE)      return false;
        return true;
      });

      if (!validFiles.length) return err(res, 400, 'Không có file hợp lệ (chỉ chấp nhận PDF, XLS, XLSX ≤ 10MB)');

      // Tạo batch
      const { data: batch, error: batchErr } = await adminClient.from('kpi_import_batches').insert({
        staff_id:     resolvedStaffId,
        staff_name:   resolvedStaffName,
        uploaded_by:  user.id,
        source_type:  'pdf_excel',
        status:       'processing',
        total_files:  validFiles.length,
        period_label: periodLabel || null,
      }).select().single();

      if (batchErr) return err(res, 500, 'Không thể tạo đợt nhập: ' + batchErr.message);

      const publicEndpoint = process.env.VITE_MINIO_ENDPOINT || process.env.MINIO_ENDPOINT_SERVER || 'http://localhost:9000';
      const resultFiles = [];

      for (const f of validFiles) {
        const ext       = ('.' + (f.name || '').split('.').pop()).toLowerCase();
        const safeName  = (f.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase();
        const storagePath = `kpi-imports/${batch.id}/${Date.now()}_${safeName}`;
        const contentType = ext === '.pdf' ? 'application/pdf'
          : ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.ms-excel';

        // Tạo presigned PUT URL (15 phút)
        let uploadUrl = null;
        try {
          uploadUrl = await getSignedUrl(
            s3Client,
            new PutObjectCommand({ Bucket: bucket, Key: storagePath, ContentType: contentType }),
            { expiresIn: 900 }
          );
        } catch (s3Err) {
          console.error('[kpi presign error]', s3Err.message);
        }

        // Tạo file record trong DB
        const { data: fileRecord } = await adminClient.from('kpi_import_files').insert({
          batch_id:     batch.id,
          file_name:    f.name,
          file_type:    ext.substring(1),
          file_size:    f.size || 0,
          storage_path: storagePath,
          parse_status: 'pending',
        }).select().single();

        resultFiles.push({
          fileId:      fileRecord?.id || null,
          name:        f.name,
          uploadUrl,
          storagePath,
          contentType,
        });
      }

      return ok(res, { batchId: batch.id, files: resultFiles });
    }

    // POST: confirm-upload
    // Browser gọi sau khi đã PUT lên MinIO thành công
    if (req.method === 'POST' && action === 'confirm-upload') {
      if (!canEdit) return err(res, 403, 'Không có quyền');

      const body = req.body || {};
      const { batchId: bid, confirmedFiles } = body;
      if (!bid) return err(res, 400, 'Thiếu batchId');

      if (Array.isArray(confirmedFiles)) {
        for (const cf of confirmedFiles) {
          if (!cf.fileId) continue;
          await adminClient.from('kpi_import_files')
            .update({ parse_status: cf.success ? 'pending' : 'failed', parse_error: cf.error || null })
            .eq('id', cf.fileId);
        }
      }

      const successCount = (confirmedFiles || []).filter(f => f.success).length;
      await adminClient.from('activity_logs').insert({
        actor_id: user.id, action: 'kpi_import_upload',
        metadata: { batch_id: bid, success_count: successCount },
      }).then(null, () => {});

      return ok(res, { confirmed: successCount });
    }

    // POST: save-documents
    if (req.method === 'POST' && action === 'save-documents') {
      if (!canEdit) return err(res, 403, 'Không có quyền lưu dữ liệu văn bản');
      if (!batchId) return err(res, 400, 'Thiếu batchId');

      const body = req.body || {};
      const { documents, fileId, fileParseStatus, staffRoles, fileParseResults } = body;
      if (!Array.isArray(documents) || !documents.length) {
        // Không có văn bản nhưng có file cần cập nhật trạng thái (parse 0 rows)
        if (Array.isArray(fileParseResults) && fileParseResults.length) {
          for (const fp of fileParseResults) {
            if (!fp.fileId) continue;
            await adminClient.from('kpi_import_files')
              .update({ parse_status: fp.parseStatus === 'failed' ? 'failed' : 'success', rows_parsed: fp.docsCount || 0 })
              .eq('id', fp.fileId).then(null, () => {});
          }
        }
        return err(res, 400, 'Không có dữ liệu văn bản');
      }

      if (fileId) await adminClient.from('kpi_documents').delete().eq('batch_id', batchId).eq('file_id', fileId);

      const isValidDate = (v) => v && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());

      const { data: insertedDocs, error: docsErr } = await adminClient.from('kpi_documents').insert(
        documents.map((d, idx) => ({
          batch_id: batchId, file_id: fileId || null,
          document_number: d.document_number || null, document_date: isValidDate(d.document_date) ? d.document_date : null,
          document_type:   d.document_type   || null, summary:        d.summary        || null,
          presenter_name:  d.presenter_name  || null, drafter_name:   d.drafter_name   || null,
          signer_name:     d.signer_name     || null, urgency_level:  d.urgency_level  || null,
          security_level:  d.security_level  || null, status:         d.status         || null,
          related_org:     d.related_org     || null, recipients:     d.recipients     || null,
          raw_data:        d.raw_data        || null, row_index:      d.row_index ?? idx,
        }))
      ).select('id');

      if (docsErr) return err(res, 500, 'Lưu văn bản thất bại: ' + docsErr.message);

      if (Array.isArray(staffRoles) && staffRoles.length && insertedDocs?.length) {
        const roleRows = staffRoles
          .filter(r => r.doc_index !== undefined && insertedDocs[r.doc_index])
          .map(r => ({
            document_id:     insertedDocs[r.doc_index].id, batch_id:        batchId,
            staff_id:        r.staff_id   || null,         staff_name:      r.staff_name,
            role_type:       r.role_type,                  confidence_score: r.confidence_score ?? 0,
            matched_field:   r.matched_field || null,      reason:           r.reason || null,
          }));
        if (roleRows.length) await adminClient.from('kpi_document_staff_roles').insert(roleRows);
      }

      // Cập nhật parse_status và rows_parsed cho từng file
      if (Array.isArray(fileParseResults) && fileParseResults.length) {
        for (const fp of fileParseResults) {
          if (!fp.fileId) continue;
          await adminClient.from('kpi_import_files')
            .update({ parse_status: fp.parseStatus === 'failed' ? 'failed' : (fp.parseStatus === 'scan_warning' ? 'scan_warning' : 'success'), rows_parsed: fp.docsCount || 0 })
            .eq('id', fp.fileId).then(null, () => {});
        }
      } else if (fileId) {
        await adminClient.from('kpi_import_files')
          .update({ parse_status: fileParseStatus || 'success', rows_parsed: documents.length })
          .eq('id', fileId);
      }

      const { count } = await adminClient.from('kpi_documents').select('id', { count: 'exact', head: true }).eq('batch_id', batchId);
      await adminClient.from('kpi_import_batches').update({ total_documents: count || 0 }).eq('id', batchId);

      return ok(res, { savedCount: insertedDocs?.length || 0 });
    }

    // DELETE: delete-batch
    if (req.method === 'DELETE' && action === 'delete-batch') {
      if (!canEdit) return err(res, 403, 'Không có quyền xóa đợt nhập');
      if (!batchId) return err(res, 400, 'Thiếu batchId');

      const { data: files } = await adminClient.from('kpi_import_files').select('storage_path').eq('batch_id', batchId);
      if (files?.length) {
        for (const f of files) {
          if (f.storage_path) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: f.storage_path })).catch(() => {});
          }
        }
      }

      const { error: delErr } = await adminClient.from('kpi_import_batches').delete().eq('id', batchId);
      if (delErr) return err(res, 500, 'Xóa thất bại: ' + delErr.message);

      await adminClient.from('activity_logs').insert({ actor_id: user.id, action: 'kpi_import_delete', metadata: { batch_id: batchId } }).then(null, () => {});
      return ok(res, { message: 'Đã xóa đợt nhập và toàn bộ dữ liệu liên quan' });
    }

    return err(res, 404, 'Endpoint không tồn tại');

  } catch (globalErr) {
    console.error('[KPI API Error]', globalErr);
    return err(res, 500, 'Lỗi hệ thống: ' + globalErr.message);
  }
}

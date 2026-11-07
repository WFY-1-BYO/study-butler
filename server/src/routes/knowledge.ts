import { Router } from "express";
import { getSupabaseClient } from "@/storage/database/supabase-client.js";

const router = Router();
const db = getSupabaseClient();

// GET /api/v1/knowledge?subject_id=1
// 列出某学科的学习资料（AI 的"记忆库"）
router.get("/", async (req, res) => {
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : undefined;
  let query: any = db.from("knowledge").select("*").order("created_at", { ascending: false });
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/v1/knowledge/count
// 统计每个学科的资料数量（用于学习计划页展示"已有资料"）
router.get("/count", async (_req, res) => {
  const { data, error } = await db.from("knowledge").select("subject_id");
  if (error) return res.status(500).json({ error: error.message });
  const count: Record<number, number> = {};
  (data || []).forEach((r) => {
    if (r.subject_id != null) count[r.subject_id] = (count[r.subject_id] || 0) + 1;
  });
  res.json(count);
});

// POST /api/v1/knowledge
// body: { subject_id, title, content }  —— 手动添加一条学习资料，进入 AI 记忆库
router.post("/", async (req, res) => {
  const { subject_id, title, content } = req.body;
  if (!subject_id || !title || !content) {
    return res.status(400).json({ error: "subject_id、title、content 都不能为空" });
  }
  if (String(content).trim().length < 10) {
    return res.status(400).json({ error: "资料内容太短，请至少输入 10 个字" });
  }
  const { data, error } = await db
    .from("knowledge")
    .insert({ subject_id: Number(subject_id), title: String(title).trim(), content: String(content).trim() })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/v1/knowledge/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { error } = await db.from("knowledge").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
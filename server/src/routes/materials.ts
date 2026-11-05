import { Router } from "express";
import { getSupabaseClient } from "@/storage/database/supabase-client.js";

const router = Router();
const db = getSupabaseClient();

// GET /api/v1/materials?subject_id=&week_no=
router.get("/", async (req, res) => {
  const { subject_id, week_no } = req.query;
  let query = db.from("materials").select("*, subjects(name, color)").order("created_at", { ascending: false }).limit(500);
  if (subject_id) query = query.eq("subject_id", Number(subject_id));
  if (week_no) query = query.eq("week_no", Number(week_no));
  const { data, error } = await query;
  if (error) {
    console.error("查询资料失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

// POST /api/v1/materials
router.post("/", async (req, res) => {
  const { subject_id, week_no, topic, type, title, content, source, ai_generated } = req.body;
  if (!subject_id || !title || !content) return res.status(400).json({ error: "subject_id/title/content 不能为空" });
  const { data, error } = await db
    .from("materials")
    .insert({
      subject_id,
      week_no: week_no ?? 1,
      topic: topic || "",
      type: type || "material",
      title,
      content,
      source: source || null,
      ai_generated: ai_generated ?? true,
    })
    .select()
    .single();
  if (error) {
    console.error("创建资料失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// GET /api/v1/materials/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { data, error } = await db.from("materials").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("查询资料失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: "资料不存在" });
  res.json(data);
});

// DELETE /api/v1/materials/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { error } = await db.from("materials").delete().eq("id", id);
  if (error) {
    console.error("删除资料失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

export default router;
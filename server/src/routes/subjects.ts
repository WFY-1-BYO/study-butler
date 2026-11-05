import { Router } from "express";
import { getSupabaseClient } from "@/storage/database/supabase-client.js";

const router = Router();
const db = getSupabaseClient();

// GET /api/v1/subjects
router.get("/", async (req, res) => {
  const { data, error } = await db
    .from("subjects")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) {
    console.error("查询学科失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// GET /api/v1/subjects/with-stats
// 返回科目 + 相关联的事件/资料统计
router.get("/with-stats", async (req, res) => {
  const { data: subjects, error: subErr } = await db
    .from("subjects")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (subErr) {
    console.error("查询学科失败:", subErr.message);
    return res.status(500).json({ error: subErr.message });
  }

  const { data: events, error: evErr } = await db
    .from("events")
    .select("id, subject_id, done");
  if (evErr) {
    console.error("查询事件失败:", evErr.message);
    return res.status(500).json({ error: evErr.message });
  }
  const { data: materials, error: matErr } = await db
    .from("materials")
    .select("id, subject_id");
  if (matErr) {
    console.error("查询资料失败:", matErr.message);
    return res.status(500).json({ error: matErr.message });
  }
  const { data: tasks, error: taskErr } = await db.from("plan_tasks").select("event_id, done");
  if (taskErr) {
    console.error("查询计划任务失败:", taskErr.message);
    return res.status(500).json({ error: taskErr.message });
  }

  const eventMap: Record<number, any[]> = {};
  events.forEach((e: any) => {
    (eventMap[e.subject_id] = eventMap[e.subject_id] || []).push(e);
  });
  const matCount: Record<number, number> = {};
  materials.forEach((m: any) => {
    matCount[m.subject_id] = (matCount[m.subject_id] || 0) + 1;
  });

  const result = (subjects || []).map((s: any) => ({
    ...s,
    event_count: (eventMap[s.id] || []).length,
    material_count: matCount[s.id] || 0,
    progress: (() => {
      const evs = eventMap[s.id] || [];
      if (evs.length === 0) return 0;
      const done = evs.filter((e) => e.done).length;
      return Math.round((done / evs.length) * 100);
    })(),
  }));
  res.json(result);
});

// POST /api/v1/subjects
router.post("/", async (req, res) => {
  const { name, color, current_progress } = req.body;
  if (!name) return res.status(400).json({ error: "name 不能为空" });
  const { data, error } = await db
    .from("subjects")
    .insert({ name, color: color || "#4F46E5", current_progress: current_progress || null })
    .select()
    .single();
  if (error) {
    console.error("创建学科失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// GET /api/v1/subjects/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { data, error } = await db.from("subjects").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("查询学科失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: "学科不存在" });
  res.json(data);
});

// PUT /api/v1/subjects/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { name, color, current_progress } = req.body;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (color !== undefined) patch.color = color;
  if (current_progress !== undefined) patch.current_progress = current_progress;
  const { data, error } = await db.from("subjects").update(patch).eq("id", id).select().single();
  if (error) {
    console.error("更新学科失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// DELETE /api/v1/subjects/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { error } = await db.from("subjects").delete().eq("id", id);
  if (error) {
    console.error("删除学科失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

export default router;
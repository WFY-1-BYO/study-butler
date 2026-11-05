import { Router } from "express";
import { getSupabaseClient } from "@/storage/database/supabase-client.js";

const router = Router();
const db = getSupabaseClient();

// GET /api/v1/plan-tasks?date=YYYY-MM-DD
// 查询某一天的所有计划任务（用于今日看板）
router.get("/", async (req, res) => {
  const { date } = req.query;
  if (date) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const { data, error } = await db
      .from("plan_tasks")
      .select("*, events(title, subject_id, subjects(name, color))")
      .gte("plan_date", dayStart.toISOString())
      .lt("plan_date", dayEnd.toISOString())
      .order("plan_date", { ascending: true });
    if (error) {
      console.error("查询计划任务失败:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json(data || []);
    return;
  }
  const { data, error } = await db
    .from("plan_tasks")
    .select("*, events(title)")
    .order("plan_date", { ascending: true })
    .limit(500);
  if (error) {
    console.error("查询计划任务失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

// POST /api/v1/plan-tasks
router.post("/", async (req, res) => {
  const { event_id, plan_date, task, minutes, is_fallback } = req.body;
  if (!event_id || !plan_date || !task) return res.status(400).json({ error: "event_id/plan_date/task 不能为空" });
  const { data, error } = await db
    .from("plan_tasks")
    .insert({
      event_id,
      plan_date,
      task,
      minutes: minutes ?? 25,
      is_fallback: is_fallback ?? false,
    })
    .select()
    .single();
  if (error) {
    console.error("创建计划任务失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// 批量更新完成状态
// POST /api/v1/plan-tasks/batch-done  body: { ids: number[], done: boolean }
router.post("/batch-done", async (req, res) => {
  const { ids, done } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids 不能为空" });
  const { data, error } = await db
    .from("plan_tasks")
    .update({ done: !!done })
    .in("id", ids)
    .select();
  if (error) {
    console.error("更新计划任务失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

// PUT /api/v1/plan-tasks/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { task, minutes, done, is_fallback, plan_date } = req.body;
  const patch: Record<string, unknown> = {};
  if (task !== undefined) patch.task = task;
  if (minutes !== undefined) patch.minutes = minutes;
  if (done !== undefined) patch.done = done;
  if (is_fallback !== undefined) patch.is_fallback = is_fallback;
  if (plan_date !== undefined) patch.plan_date = plan_date;
  const { data, error } = await db.from("plan_tasks").update(patch).eq("id", id).select().single();
  if (error) {
    console.error("更新计划任务失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// DELETE /api/v1/plan-tasks/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { error } = await db.from("plan_tasks").delete().eq("id", id);
  if (error) {
    console.error("删除计划任务失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

export default router;
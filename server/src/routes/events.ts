import { Router } from "express";
import { getSupabaseClient } from "@/storage/database/supabase-client.js";

const router = Router();
const db = getSupabaseClient();

// GET /api/v1/events
// Query: include_tasks=true 时返回每个事件关联的 plan_tasks
router.get("/", async (req, res) => {
  const includeTasks = req.query.include_tasks === "true";
  const { data: events, error } = await db
    .from("events")
    .select("*")
    .order("start_at", { ascending: true })
    .limit(500);
  if (error) {
    console.error("查询事件失败:", error.message);
    return res.status(500).json({ error: error.message });
  }

  if (includeTasks && events) {
    const ids = events.map((e) => e.id);
    let tasks: any[] = [];
    if (ids.length > 0) {
      // 批量分批查询，避免 URL 过长
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const t = await db.from("plan_tasks").select("*").in("event_id", batch).order("plan_date", { ascending: true });
        if (t.error) throw new Error(`查询计划任务失败: ${t.error.message}`);
        tasks = tasks.concat(t.data || []);
      }
    }
    const taskMap: Record<number, any[]> = {};
    tasks.forEach((t) => {
      (taskMap[t.event_id] = taskMap[t.event_id] || []).push(t);
    });
    res.json((events || []).map((e) => ({ ...e, tasks: taskMap[e.id] || [] })));
    return;
  }
  res.json(events || []);
});

// GET /api/v1/events/today
// 返回今天相关的所有事件及倒计时
router.get("/today", async (req, res) => {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const { data: today, error: errToday } = await db
    .from("events")
    .select("*")
    .gte("start_at", dayStart.toISOString())
    .lt("start_at", dayEnd.toISOString())
    .order("start_at", { ascending: true });
  if (errToday) {
    console.error("查询今日事件失败:", errToday.message);
    return res.status(500).json({ error: errToday.message });
  }

  const { data: upcoming, error: errUp } = await db
    .from("events")
    .select("*")
    .gt("start_at", dayEnd.toISOString())
    .order("start_at", { ascending: true })
    .limit(30);
  if (errUp) {
    console.error("查询未来事件失败:", errUp.message);
    return res.status(500).json({ error: errUp.message });
  }

  const decorate = (e: any) => {
    const start = new Date(e.start_at);
    const diffMs = start.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return { ...e, days_left: daysLeft };
  };

  res.json({
    today: (today || []).map(decorate),
    upcoming: (upcoming || []).map(decorate),
  });
});

// GET /api/v1/events/brief
// 早间简报：聚合未来 7 天任务，按 紧急/常规/弹性 三档分组，附资料就绪状态
router.get("/brief", async (req, res) => {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(dayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: events, error } = await db
    .from("events")
    .select("*")
    .gte("start_at", dayStart.toISOString())
    .lt("start_at", horizon.toISOString())
    .order("start_at", { ascending: true });
  if (error) {
    console.error("查询简报事件失败:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const ids = (events || []).filter((e: any) => e.id).map((e: any) => e.id);
  let tasks: any[] = [];
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const t = await db.from("plan_tasks").select("*").in("event_id", batch).order("plan_date", { ascending: true });
      if (t.error) throw new Error(`查询计划任务失败: ${t.error.message}`);
      tasks = tasks.concat(t.data || []);
    }
  }
  const taskMap: Record<number, any[]> = {};
  tasks.forEach((t: any) => {
    (taskMap[t.event_id] = taskMap[t.event_id] || []).push(t);
  });

  const decorate = (e: any) => {
    const start = new Date(e.start_at);
    const d = new Date(e.start_at);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      ...e,
      date_key: dateKey,
      days_left: Math.ceil((start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      tasks: (taskMap[e.id] || []).filter((t) => t.plan_date && t.plan_date.startsWith(dateKey)),
    };
  };

  const list = (events || []).map(decorate);
  res.json({
    urgent: list.filter((e) => e.priority === "urgent"),
    regular: list.filter((e) => e.priority === "regular"),
    flexible: list.filter((e) => e.priority === "flexible"),
    all: list,
  });
});

// POST /api/v1/events
router.post("/", async (req, res) => {
  const { subject_id, title, type, start_at, remind_before_min, priority, need_quiz, need_material, material_status, notes } = req.body;
  if (!title || !start_at) return res.status(400).json({ error: "title 和 start_at 不能为空" });
  const { data, error } = await db
    .from("events")
    .insert({
      subject_id: subject_id || null,
      title,
      type: type || "test",
      start_at,
      remind_before_min: remind_before_min ?? 1440,
      priority: priority || "regular",
      need_quiz: need_quiz ?? false,
      need_material: need_material ?? false,
      material_status: material_status || "none",
      notes: notes || null,
    })
    .select()
    .single();
  if (error) {
    console.error("创建事件失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// GET /api/v1/events/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { data: ev, error } = await db.from("events").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("查询事件失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!ev) return res.status(404).json({ error: "事件不存在" });
  const { data: tasks, error: taskErr } = await db
    .from("plan_tasks")
    .select("*")
    .eq("event_id", id)
    .order("plan_date", { ascending: true });
  if (taskErr) {
    console.error("查询计划任务失败:", taskErr.message);
    return res.status(500).json({ error: taskErr.message });
  }
  res.json({ ...ev, tasks: tasks || [] });
});

// PUT /api/v1/events/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { subject_id, title, type, start_at, remind_before_min, priority, need_quiz, need_material, material_status, notes, done } = req.body;
  const patch: Record<string, unknown> = {};
  if (subject_id !== undefined) patch.subject_id = subject_id;
  if (title !== undefined) patch.title = title;
  if (type !== undefined) patch.type = type;
  if (start_at !== undefined) patch.start_at = start_at;
  if (remind_before_min !== undefined) patch.remind_before_min = remind_before_min;
  if (priority !== undefined) patch.priority = priority;
  if (need_quiz !== undefined) patch.need_quiz = need_quiz;
  if (need_material !== undefined) patch.need_material = need_material;
  if (material_status !== undefined) patch.material_status = material_status;
  if (notes !== undefined) patch.notes = notes;
  if (done !== undefined) patch.done = done;
  const { data, error } = await db.from("events").update(patch).eq("id", id).select().single();
  if (error) {
    console.error("更新事件失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// DELETE /api/v1/events/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 id" });
  const { error } = await db.from("events").delete().eq("id", id);
  if (error) {
    console.error("删除事件失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

export default router;
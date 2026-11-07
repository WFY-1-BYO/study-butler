import { Router } from "express";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client.js";

const router = Router();
const db = getSupabaseClient();

function safeJsonParse(text: string): any {
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    /* ignore */
  }
  // 如果 LLM 返回了代码块包裹，去掉 ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* ignore */
    }
  }
  // 去掉首个 { 之前和最后一个 } 之后的内容
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function llmInvoke(system: string, user: string): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config);
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  const resp = await client.invoke(messages, { model: "doubao-seed-2-0-pro-260215", temperature: 0.6 });
  return resp.content;
}

// 从知识库中检索某学科相关的学习资料，作为 AI 出题/备料的"教材依据"
async function fetchRelevantKnowledge(
  subjectId: number | null,
  keyword?: string
): Promise<{ title: string; content: string }[]> {
  if (subjectId == null) return [];
  const { data, error } = await db
    .from("knowledge")
    .select("title, content")
    .eq("subject_id", subjectId)
    .limit(20);
  if (error || !data || data.length === 0) return [];
  // 若有关键词，按相关性粗略排序（包含关键词的靠前）
  if (keyword) {
    const kw = keyword.trim().toLowerCase();
    data.sort((a, b) => {
      const ab = (a.content + a.title).toLowerCase().includes(kw) ? 1 : 0;
      const bb = (b.content + b.title).toLowerCase().includes(kw) ? 1 : 0;
      return bb - ab;
    });
  }
  return data.slice(0, 6);
}

// POST /api/v1/ai/plan-event
// body: { event_id }  —— 为事件倒推生成每日计划任务并写库
router.post("/plan-event", async (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: "event_id 不能为空" });
  const id = Number(event_id);

  const { data: ev, error: evErr } = await db.from("events").select("*").eq("id", id).maybeSingle();
  if (evErr) {
    console.error("查询事件失败:", evErr.message);
    return res.status(500).json({ error: evErr.message });
  }
  if (!ev) return res.status(404).json({ error: "事件不存在" });

  const subjectName = ev.subject_id
    ? (await db.from("subjects").select("name").eq("id", ev.subject_id).maybeSingle()).data?.name
    : null;

  const now = new Date();
  const start = new Date(ev.start_at);
  const daysLeft = Math.max(1, Math.ceil((start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  // 最多拆 7 天
  const span = Math.min(daysLeft, 7);
  const startDate = new Date(now.getTime() + Math.max(0, daysLeft - span) * 24 * 60 * 60 * 1000);

  const system = "你是一名极度高效的中学生学习管家。你的任务是给一个事件倒推出每日学习计划，按「最小可执行方案」原则。只输出 JSON，不要任何多余文字。";
  const user = `事件：${ev.title}（${subjectName || "无科目"}），今天是 ${now.toLocaleDateString()}，将于 ${start.toLocaleDateString()} 进行，剩余约 ${daysLeft} 天。
请拆出 ${span} 天（从 ${startDate.toLocaleDateString()} 到 ${start.toLocaleDateString()}）的每日任务，每天一个 ≤30 分钟的小任务，并标注哪一天是最低保底日（只做那件事也能基本准备，is_fallback=true）。
输出 JSON 数组，格式：[{"date":"YYYY-MM-DD","task":"任务描述","minutes":20,"is_fallback":false}]`;

  try {
    const raw = await llmInvoke(system, user);
    const tasks = safeJsonParse(raw);
    if (!Array.isArray(tasks)) {
      // 兜底：LLM 输出异常时生成简单拆解，绝不用模拟数据
      const fallbackTasks = Array.from({ length: span }, (_, i) => {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        return {
          date: d.toISOString().slice(0, 10),
          task: `复习《${ev.title}》第 ${i + 1} 天`,
          minutes: 25,
          is_fallback: i === span - 1,
        };
      });
      await insertTasks(id, fallbackTasks);
      return res.json({ tasks: fallbackTasks, fallback: true });
    }
    // 清洗字段
    const cleaned = tasks
      .filter((t: any) => t && t.date && t.task)
      .map((t: any) => ({
        date: String(t.date).slice(0, 10),
        task: String(t.task),
        minutes: Number(t.minutes) || 25,
        is_fallback: !!t.is_fallback,
      }));
    if (cleaned.length === 0) throw new Error("空任务");
    await insertTasks(id, cleaned);
    res.json({ tasks: cleaned, fallback: false });
  } catch (e: any) {
    console.error("AI 生成计划失败:", e.message);
    res.status(500).json({ error: e.message });
  }
});

async function insertTasks(event_id: number, tasks: any[]) {
  for (let i = 0; i < tasks.length; i += 50) {
    const batch = tasks.slice(i, i + 50).map((t) => ({
      event_id,
      plan_date: `${t.date}T08:00:00.000Z`,
      task: t.task,
      minutes: t.minutes,
      is_fallback: t.is_fallback,
    }));
    const { error } = await db.from("plan_tasks").insert(batch);
    if (error) throw new Error(error.message);
  }
}

// POST /api/v1/ai/quiz
// body: { event_id }  —— 为"需抽查"的背诵任务随机生成 3~5 道自测题并写库
router.post("/quiz", async (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: "event_id 不能为空" });
  const id = Number(event_id);
  const { data: ev, error: evErr } = await db.from("events").select("*").eq("id", id).maybeSingle();
  if (evErr) {
    console.error("查询事件失败:", evErr.message);
    return res.status(500).json({ error: evErr.message });
  }
  if (!ev) return res.status(404).json({ error: "事件不存在" });

  const { data: existing, error: exErr } = await db.from("quizzes").select("*").eq("event_id", id).limit(10);
  if (exErr) {
    console.error("查询题目失败:", exErr.message);
    return res.status(500).json({ error: exErr.message });
  }
  if (existing && existing.length >= 3) return res.json({ quizzes: existing, from_cache: true });

  // 检索该事件对应学科自己的资料，作为出题依据
  const knowledge = await fetchRelevantKnowledge(ev.subject_id, ev.notes || ev.title);
  const materialBlock =
    knowledge.length > 0
      ? "\n\n以下是我自己录入的学习资料（务必严格基于这些内容出题，不要超出）:\n" +
        knowledge.map((k) => `【${k.title}】\n${k.content}`).join("\n\n")
      : "\n\n（注意：用户还没有录入该学科的学习资料，请基于你学科通识出题，并避免编造具体公式以外的细节）";

  const system = "你是抽查自测的出题者。根据学习内容生成 3~5 道自测题，去检验学生是否真的记住了。只输出 JSON 数组，不要多余文字。格式：[{\"question\":\"问题\",\"answer\":\"答案\",\"hint\":\"提示词\"}]";
  const user = `请为事件「${ev.title}」（备注：${ev.notes || "无"}）生成 3~5 道抽查自测题，覆盖核心知识点，问法要有变化并适合快速自测。${materialBlock}`;

  try {
    const raw = await llmInvoke(system, user);
    const parsed = safeJsonParse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed?.quizzes;
    if (!Array.isArray(arr) || arr.length === 0) {
      return res.status(500).json({ error: "AI 返回格式异常，请重试" });
    }
    const rows = arr
      .filter((q: any) => q && q.question && q.answer)
      .slice(0, 5)
      .map((q: any) => ({ event_id: id, question: String(q.question), answer: String(q.answer), hint: q.hint ? String(q.hint) : null }));
    if (rows.length === 0) return res.status(500).json({ error: "题目生成失败" });
    const { data, error: insErr } = await db.from("quizzes").insert(rows).select();
    if (insErr) {
      console.error("保存题目失败:", insErr.message);
      return res.status(500).json({ error: insErr.message });
    }
    res.status(201).json({ quizzes: data, from_cache: false });
  } catch (e: any) {
    console.error("AI 生成题目失败:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/ai/quiz/:event_id
// 读取某事件已生成的抽查题
router.get("/quiz/:event_id", async (req, res) => {
  const id = Number(req.params.event_id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "无效 event_id" });
  const { data, error } = await db.from("quizzes").select("*").eq("event_id", id).order("created_at", { ascending: true });
  if (error) {
    console.error("查询题目失败:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

// POST /api/v1/ai/prefetch-material
// body: { event_id, subject_id, topic }  —— 资料预取：为将开始的任务提前备好资料
router.post("/prefetch-material", async (req, res) => {
  const { event_id, subject_id, topic } = req.body;
  if (!event_id || !subject_id) return res.status(400).json({ error: "event_id 和 subject_id 不能为空" });

  // 先标记为 preparing
  await db.from("events").update({ material_status: "preparing" }).eq("id", Number(event_id));

  const subRes = await db.from("subjects").select("name").eq("id", Number(subject_id)).maybeSingle();
  if (subRes.error || !subRes.data) return res.status(404).json({ error: "学科不存在" });
  const subjectName = subRes.data.name;
  const topic2 = topic || "预习材料";

  // 检索该学科自己的资料，作为预取依据
  const knowledge = await fetchRelevantKnowledge(Number(subject_id), topic2);
  const materialBlock =
    knowledge.length > 0
      ? "\n\n以下是我自己录入了该学科的学习资料（务必结合这些内容做导读和出题）:\n" +
        knowledge.map((k) => `【${k.title}】\n${k.content}`).join("\n\n")
      : "";

  const config = new Config();
  const client = new LLMClient(config);
  const system = `你是「前瞻管家」的资料预取员。为「${subjectName}」的主题「${topic2}」提前准备一份轻量学习包，让学生在开始学习前就能快速进入状态。只输出严格 JSON，不要多余文字。
JSON 结构：
{
  "concepts": [{"title":"核心概念1","desc":"简明讲解，不超过50字"}, ...共3条],
  "outer_text": "一段200字内的背景/导读文字",
  "vocabulary": [{"word":"生词/术语","meaning":"释义"}, ...3~8条],
  "questions": [{"level":"易/中/难","content":"2~3道预热或外刊理解题"}],
  "sources": ["来源1描述", "来源2描述", "来源3描述"]
}`;

  const user = `请为《${subjectName}》主题「${topic2}」生成资料预取包。这是外刊/网课/物料类的预习材料，要能在任务开始前让学生快速进入状态。${materialBlock}`;

  try {
    let raw = "";
    const stream = client.stream(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "doubao-seed-2-0-pro-260215", temperature: 0.6 }
    );
    for await (const chunk of stream) {
      if (chunk.content) raw += chunk.content.toString();
    }
    const parsed = safeJsonParse(raw);
    if (!parsed || !Array.isArray(parsed.concepts)) {
      await db.from("events").update({ material_status: "failed" }).eq("id", Number(event_id));
      return res.status(500).json({ error: "AI 返回格式异常，请重试" });
    }

    const weekNo = Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const { data: material, error: insErr } = await db
      .from("materials")
      .insert({
        subject_id: Number(subject_id),
        week_no: weekNo,
        topic: topic2,
        type: "material_prep",
        title: `${subjectName} ${topic2}（预取）`,
        content: parsed,
        source: "AI 前置预取",
        ai_generated: true,
      })
      .select()
      .single();
    if (insErr) {
      await db.from("events").update({ material_status: "failed" }).eq("id", Number(event_id));
      return res.status(500).json({ error: insErr.message });
    }
    await db.from("events").update({ material_status: "ready" }).eq("id", Number(event_id));
    res.status(201).json({ material, status: "ready" });
  } catch (e: any) {
    console.error("AI 预取资料失败:", e.message);
    await db.from("events").update({ material_status: "failed" }).eq("id", Number(event_id));
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/ai/material
// body: { subject_id, week_no, topic, title }
// 生成学习材料：3条核心概念 + 10道题(3易5中2难) + 答案&错因 + 一句话易错点
router.post("/material", async (req, res) => {
  const config = new Config();
  const client = new LLMClient(config);

  const { subject_id, week_no, topic, title } = req.body;
  if (!subject_id || !topic) return res.status(400).json({ error: "subject_id 和 topic 不能为空" });

  const subjectId = Number(subject_id);
  const subRes = await db.from("subjects").select("name").eq("id", subjectId).maybeSingle();
  if (subRes.error || !subRes.data) return res.status(404).json({ error: "学科不存在" });
  const subjectName = subRes.data.name;

  // 检索该学科自己录入的资料，作为出题和讲解的教材依据
  const knowledge = await fetchRelevantKnowledge(subjectId, topic);
  const materialBlock =
    knowledge.length > 0
      ? "\n\n以下是我自己录入了该学科的学习资料（务必严格基于这些内容讲解与出题，引用其中的公式/定义/术语，不要凭空编造）:\n" +
        knowledge.map((k) => `【${k.title}】\n${k.content}`).join("\n\n")
      : "\n\n（注意：用户还没有为该学科录入资料，请基于学科通识讲解，但要避免编造超出规律的细节，并在文末提示用户可录入教材以更贴合）";

  const system = `你是中国中学/大学的一对一私教老师。为「${subjectName}」第 ${week_no} 周的专题「${topic}」准备一份高质量学习材料。只输出严格 JSON，不要多余文字。
JSON 结构：
{
  "concepts": [{"title":"核心概念1","desc":"简明讲解，不超过60字"}, ...共3条],
  "questions": [{"level":"易/中/难","content":"题目内容"}, ...共10题：3易5中2难],
  "answers": [{"index":0,"answer":"答案","reason":"错因分析，说明选错/答错的学生通常错在哪"}],
  "pitfall": "一句话：这一节学生最容易错的地方，以及避开方法"
}`;

  const user = `请为《${subjectName}》第 ${week_no} 周、专题「${topic}」生成材料，题目类型要多样化。${materialBlock}`;

  try {
    // 流式收集
    let raw = "";
    const stream = client.stream(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "doubao-seed-2-0-pro-260215", temperature: 0.6 }
    );
    for await (const chunk of stream) {
      if (chunk.content) raw += chunk.content.toString();
    }
    const parsed = safeJsonParse(raw);
    if (!parsed || !Array.isArray(parsed.questions) || !Array.isArray(parsed.concepts)) {
      return res.status(500).json({ error: "AI 返回格式异常，请重试" });
    }

    const { data, error } = await db
      .from("materials")
      .insert({
        subject_id: subjectId,
        week_no: week_no ?? 1,
        topic,
        type: "material",
        title: title || `${subjectName} W${week_no} ${topic}`,
        content: parsed,
        source: "AI 生成，需自行核对",
        ai_generated: true,
      })
      .select()
      .single();
    if (error) {
      console.error("保存材料失败:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (e: any) {
    console.error("AI 生成材料失败:", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
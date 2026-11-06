import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { Screen } from '@/components/Screen';
import { SmartDateInput } from '@/components/SmartDateInput';
import { api } from '@/utils/api';
import {
  Subject,
  Event,
  PlanTask,
  Quiz,
  EVENT_TYPES,
  PRIORITIES,
  typeLabel,
  formatAbs,
  daysBetween,
  priorityLabel,
} from '@/utils/types';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';

// ---------- 子组件：计划任务列表 ----------
function PlanList({
  event,
  tasks,
  onRefresh,
}: {
  event: Event | null;
  tasks: PlanTask[];
  onRefresh: () => void;
}) {
  if (!event || tasks.length === 0) {
    return (
      <View className="py-4">
        <Text className="text-gray-400 text-sm text-center">还没有倒推计划，点「AI 生计划」自动生成</Text>
      </View>
    );
  }
  const toggle = async (t: PlanTask) => {
    try {
      await api.put(`/api/v1/plan-tasks/${t.id}`, { done: !t.done });
      onRefresh();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '操作失败', text2: e.message });
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {tasks.map((t) => (
        <TouchableOpacity
          key={t.id}
          onPress={() => toggle(t)}
          className={`rounded-2xl p-3 flex-row items-center gap-3 ${t.is_fallback ? 'border border-emerald-200' : ''}`}
          style={{ backgroundColor: t.done ? '#F3F4F6' : '#F7F5F0' }}
        >
          <View className={`w-6 h-6 rounded-full items-center justify-center ${t.done ? 'bg-emerald-500' : 'border-2 border-gray-300'}`}>
            {t.done ? <FontAwesome6 name="check" size={12} color="#fff" /> : null}
          </View>
          <View className="flex-1">
            <Text className={`text-sm ${t.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {t.task}
            </Text>
            <Text className="text-xs text-gray-400">
              {formatAbs(t.plan_date)} · {t.minutes} 分钟
              {t.is_fallback ? ' · 保底' : ''}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { focus, id } = useSafeSearchParams<{ focus?: string; id?: string }>();

  const [events, setEvents] = useState<(Event & { tasks?: PlanTask[] })[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Event | null>(null);
  const [generating, setGenerating] = useState(false);

  // 抽查自测
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [quizEvent, setQuizEvent] = useState<Event | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});

  // 表单
  const [title, setTitle] = useState('');
  const [type, setType] = useState('test');
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [remindBefore, setRemindBefore] = useState(1440);
  const [priority, setPriority] = useState('regular');
  const [needQuiz, setNeedQuiz] = useState(false);
  const [needMaterial, setNeedMaterial] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const evts = await api.get<(Event & { tasks?: PlanTask[] })[]>(
        '/api/v1/events?include_tasks=true'
      );
      setEvents(evts || []);
      const subs = await api.get<Subject[]>('/api/v1/subjects');
      setSubjects(subs || []);

      // 深链：高亮并打开详情
      if (focus === 'detail' && id) {
        setDetailId(Number(id));
      }
      if (focus === 'quiz' && id) {
        setDetailId(Number(id));
        openQuiz(Number(id), evts.find((x) => x.id === Number(id)) || null);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
    }
  }, [focus, id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setType('test');
    setSubjectId(subjects[0]?.id ?? null);
    setStartAt(null);
    setRemindBefore(1440);
    setPriority('regular');
    setNeedQuiz(false);
    setNeedMaterial(false);
    setNotes('');
    setModalVisible(true);
  };

  const openEdit = (e: Event) => {
    setEditing(e);
    setTitle(e.title);
    setType(e.type);
    setSubjectId(e.subject_id);
    setStartAt(e.start_at);
    setRemindBefore(e.remind_before_min);
    setPriority(e.priority || 'regular');
    setNeedQuiz(!!e.need_quiz);
    setNeedMaterial(!!e.need_material);
    setNotes(e.notes || '');
    setModalVisible(true);
  };

  const openQuiz = async (evId: number, ev: Event | null) => {
    setQuizEvent(ev);
    setQuizModalVisible(true);
    setReveal({});
    setQuizLoading(true);
    try {
      const qs = await api.get<Quiz[]>(`/api/v1/ai/quiz/${evId}`);
      if (qs && qs.length > 0) {
        setQuizzes(qs);
      } else {
        await api.post('/api/v1/ai/quiz', { event_id: evId });
        const qs2 = await api.get<Quiz[]>(`/api/v1/ai/quiz/${evId}`);
        setQuizzes(qs2 || []);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '加载抽查题失败', text2: e.message });
      setQuizzes([]);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: '请填写标题' });
      return;
    }
    if (!startAt) {
      Toast.show({ type: 'error', text1: '请选择时间' });
      return;
    }
    try {
      if (editing) {
        await api.put(`/api/v1/events/${editing.id}`, {
          title: title.trim(),
          type,
          subject_id: subjectId,
          start_at: startAt,
          remind_before_min: remindBefore,
          priority,
          need_quiz: needQuiz,
          need_material: needMaterial,
          notes: notes.trim() || null,
        });
      } else {
        await api.post('/api/v1/events', {
          title: title.trim(),
          type,
          subject_id: subjectId,
          start_at: startAt,
          remind_before_min: remindBefore,
          priority,
          need_quiz: needQuiz,
          need_material: needMaterial,
          notes: notes.trim() || null,
        });
      }
      setModalVisible(false);
      Toast.show({ type: 'success', text1: '已保存' });
      fetchData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '保存失败', text2: e.message });
    }
  };

  const handleDelete = async (e: Event) => {
    try {
      await api.delete(`/api/v1/events/${e.id}`);
      Toast.show({ type: 'success', text1: '已删除' });
      fetchData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: '删除失败', text2: err.message });
    }
  };

  const handleAiPlan = async (e: Event) => {
    try {
      setGenerating(true);
      await api.post('/api/v1/ai/plan-event', { event_id: e.id });
      Toast.show({ type: 'success', text1: 'AI 已生成倒推计划' });
      fetchData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: '生成失败', text2: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrefetch = async (e: Event) => {
    if (!e.subject_id) {
      Toast.show({ type: 'error', text1: '请先给这个事件选一个学科' });
      return;
    }
    try {
      setGenerating(true);
      await api.post('/api/v1/ai/prefetch-material', {
        event_id: e.id,
        subject_id: e.subject_id,
        topic: e.title,
      });
      Toast.show({ type: 'success', text1: '资料已就绪', text2: '去「资料库」查看' });
      fetchData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: '预取失败', text2: err.message });
      fetchData();
    } finally {
      setGenerating(false);
    }
  };

  const subjectById = (id: number | null) => subjects.find((s) => s.id === id);
  const detailEvent = events.find((e) => e.id === detailId) || null;

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']} statusBarStyle="auto">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-3">
          <View>
            <Text className="text-2xl font-extrabold text-gray-900">日程</Text>
            <Text className="text-xs text-gray-400">考试、作业、活动都有了着落</Text>
          </View>
          <TouchableOpacity
            onPress={openCreate}
            className="w-11 h-11 rounded-2xl items-center justify-center"
            style={{ backgroundColor: '#3730A3' }}
          >
            <FontAwesome6 name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 列表（平板双栏） */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 16,
            maxWidth: isTablet ? 900 : undefined,
            width: isTablet ? '100%' : undefined,
            alignSelf: 'center',
            paddingBottom: 30,
          }}
        >
          <View className="flex-row flex-wrap" style={{ gap: isTablet ? 14 : 10 }}>
            {events.length === 0 ? (
              <View className="w-full py-16 items-center">
                <FontAwesome6 name="calendar-day" size={40} color="#D1D5DB" />
                <Text className="text-gray-400 mt-4 text-center">
                  还没有日程，点右上角 + 添加
                </Text>
                <Text className="text-gray-300 text-sm mt-1 text-center">
                  例如：下周三物理小测、周五交英语作文
                </Text>
              </View>
            ) : (
              events.map((e) => {
                const subj = subjectById(e.subject_id);
                const days = daysBetween(new Date(), new Date(e.start_at));
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setDetailId(e.id)}
                    className="rounded-3xl p-4 mb-1"
                    style={[
                      { width: isTablet ? '48.5%' : '100%', backgroundColor: '#FFFFFF' },
                      { shadowColor: subj?.color || '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
                    ]}
                  >
                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: subj?.color || '#9CA3AF' }} />
                      <Text className="text-xs font-bold" style={{ color: '#6B7280' }}>
                        {subj?.name || '杂项'} · {typeLabel(e.type)}
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-gray-900 mb-1">{e.title}</Text>
                    <Text className="text-xs text-gray-400">{formatAbs(e.start_at)}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* 详情 + AI 计划 Modal */}
        <Modal visible={detailId !== null} transparent animationType="fade">
          <View className="flex-1 bg-black/40 p-5 justify-center">
            <View className="bg-white rounded-3xl p-5 w-full max-w-md self-center max-h-[85%]">
              {detailEvent && (
                <>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-extrabold text-gray-900 flex-1">{detailEvent.title}</Text>
                    <TouchableOpacity onPress={() => setDetailId(null)}>
                      <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-xs text-gray-400 mb-4">{formatAbs(detailEvent.start_at)}</Text>
                  <ScrollView className="max-h-[400px]">
                    <View className="flex-row gap-3 mb-4 flex-wrap">
                      <TouchableOpacity
                        onPress={() => openEdit(detailEvent)}
                        className="flex-1 py-2.5 rounded-2xl items-center flex-row justify-center gap-2"
                        style={{ backgroundColor: '#3730A316' }}
                      >
                        <FontAwesome6 name="pen" size={14} color="#3730A3" />
                        <Text className="text-indigo-900 font-bold text-sm">编辑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleAiPlan(detailEvent)}
                        disabled={generating}
                        className="flex-1 py-2.5 rounded-2xl items-center flex-row justify-center gap-2"
                        style={{ backgroundColor: '#EA580C18' }}
                      >
                        <FontAwesome6 name="wand-magic-sparkles" size={14} color="#EA580C" />
                        <Text className="text-orange-800 font-bold text-sm">{generating ? '生成中…' : 'AI 生计划'}</Text>
                      </TouchableOpacity>
                      {detailEvent.need_quiz ? (
                        <TouchableOpacity
                          onPress={() => openQuiz(detailEvent.id, detailEvent)}
                          className="py-2.5 px-4 rounded-2xl items-center flex-row gap-1.5 justify-center"
                          style={{ backgroundColor: '#7C3AED18' }}
                        >
                          <FontAwesome6 name="q" size={14} color="#7C3AED" />
                          <Text className="text-violet-800 font-bold text-sm">抽查</Text>
                        </TouchableOpacity>
                      ) : null}
                      {detailEvent.need_material ? (
                        <TouchableOpacity
                          onPress={() => handlePrefetch(detailEvent)}
                          disabled={generating}
                          className="py-2.5 px-4 rounded-2xl items-center flex-row gap-1.5 justify-center"
                          style={{ backgroundColor: '#0EA5E918' }}
                        >
                          <FontAwesome6 name="cloud-arrow-down" size={14} color="#0284C7" />
                          <Text className="text-sky-700 font-bold text-sm">
                            {detailEvent.material_status === 'ready' ? '资料就绪' : detailEvent.material_status === 'preparing' ? '备料中' : '预取资料'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => handleDelete(detailEvent)}
                        className="py-2.5 px-4 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: '#DC262614' }}
                      >
                        <FontAwesome6 name="trash" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-sm font-bold text-gray-700 mb-2">倒推计划</Text>
                    <PlanList event={detailEvent} tasks={detailEvent.tasks || []} onRefresh={fetchData} />
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* 新增/编辑 Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View className="flex-1 bg-black/40 p-5 justify-center">
                <View className="bg-white rounded-3xl p-5 w-full max-w-md self-center">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-extrabold text-gray-900">
                      {editing ? '编辑日程' : '新增大事'}
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
                    <Text className="text-xs font-bold text-gray-500 mb-1">标题</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="比如：物理小测 / 英语作文"
                      placeholderTextColor="#9CA3AF"
                      className="rounded-2xl px-4 py-3 text-gray-900 mb-3"
                      style={{ backgroundColor: '#F3F4F6' }}
                    />

                    <Text className="text-xs font-bold text-gray-500 mb-1">类型</Text>
                    <View className="flex-row flex-wrap gap-2 mb-3">
                      {EVENT_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t.value}
                          onPress={() => setType(t.value)}
                          className="px-3 py-2 rounded-full flex-row items-center gap-1.5"
                          style={{ backgroundColor: type === t.value ? '#3730A318' : '#F3F4F6' }}
                        >
                          <FontAwesome6 name={t.icon as any} size={12} color={type === t.value ? '#3730A3' : '#6B7280'} />
                          <Text style={{ color: type === t.value ? '#3730A3' : '#6B7280', fontWeight: '600', fontSize: 12 }}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text className="text-xs font-bold text-gray-500 mb-1">所属学科</Text>
                    <View className="flex-row flex-wrap gap-2 mb-3">
                      <TouchableOpacity
                        onPress={() => setSubjectId(null)}
                        className="px-3 py-2 rounded-full"
                        style={{ backgroundColor: subjectId === null ? '#3730A318' : '#F3F4F6' }}
                      >
                        <Text style={{ color: subjectId === null ? '#3730A3' : '#6B7280', fontWeight: '600', fontSize: 12 }}>杂项</Text>
                      </TouchableOpacity>
                      {subjects.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => setSubjectId(s.id)}
                          className="px-3 py-2 rounded-full"
                          style={{ backgroundColor: subjectId === s.id ? `${s.color}26` : '#F3F4F6' }}
                        >
                          <Text style={{ color: subjectId === s.id ? s.color : '#6B7280', fontWeight: '600', fontSize: 12 }}>{s.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <SmartDateInput
                      label="日期与时间"
                      mode="datetime"
                      value={startAt}
                      onChange={setStartAt}
                    />

                    <Text className="text-xs font-bold text-gray-500 mb-1 mt-3">提前提醒</Text>
                    <View className="flex-row flex-wrap gap-2 mb-3">
                      {[
                        { v: 60, l: '1小时前' },
                        { v: 1440, l: '1天前' },
                        { v: 2880, l: '2天前' },
                      ].map((o) => (
                        <TouchableOpacity
                          key={o.v}
                          onPress={() => setRemindBefore(o.v)}
                          className="px-3 py-2 rounded-full"
                          style={{ backgroundColor: remindBefore === o.v ? '#3730A318' : '#F3F4F6' }}
                        >
                          <Text style={{ color: remindBefore === o.v ? '#3730A3' : '#6B7280', fontWeight: '600', fontSize: 12 }}>{o.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text className="text-xs font-bold text-gray-500 mb-1 mt-1">优先级</Text>
                    <View className="flex-row flex-wrap gap-2 mb-3">
                      {PRIORITIES.map((p) => (
                        <TouchableOpacity
                          key={p.value}
                          onPress={() => setPriority(p.value)}
                          className="px-3 py-2 rounded-full"
                          style={{ backgroundColor: priority === p.value ? '#3730A318' : '#F3F4F6' }}
                        >
                          <Text style={{ color: priority === p.value ? '#3730A3' : '#6B7280', fontWeight: '600', fontSize: 12 }}>{p.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View className="flex-row gap-3 mb-3">
                      <TouchableOpacity
                        onPress={() => setNeedMaterial((v) => !v)}
                        className={`flex-1 rounded-2xl p-3 flex-row items-center gap-2 ${needMaterial ? 'border border-emerald-300' : 'border border-gray-200'}`}
                      >
                        <FontAwesome6 name={needMaterial ? 'circle-check' : 'circle'} size={18} color={needMaterial ? '#059669' : '#9CA3AF'} />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-gray-800">需资料预取</Text>
                          <Text className="text-xs text-gray-400">外刊/网课/物料，提前备好</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setNeedQuiz((v) => !v)}
                        className={`flex-1 rounded-2xl p-3 flex-row items-center gap-2 ${needQuiz ? 'border border-violet-300' : 'border border-gray-200'}`}
                      >
                        <FontAwesome6 name={needQuiz ? 'circle-check' : 'circle'} size={18} color={needQuiz ? '#7C3AED' : '#9CA3AF'} />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-gray-800">需抽查</Text>
                          <Text className="text-xs text-gray-400">背诵类随机自测</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    <Text className="text-xs font-bold text-gray-500 mb-1">备注</Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="考试范围、注意事项…"
                      placeholderTextColor="#9CA3AF"
                      multiline
                      className="rounded-2xl px-4 py-3 text-gray-900 mb-3 min-h-[70px]"
                      style={{ backgroundColor: '#F3F4F6', textAlignVertical: 'top' }}
                    />
                  </ScrollView>

                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      <Text className="text-gray-600 font-bold">取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSave}
                      className="flex-[2] py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#3730A3' }}
                    >
                      <Text className="text-white font-bold">保存</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>

        {/* 抽查自测 Modal */}
        <Modal visible={quizModalVisible} transparent animationType="fade">
          <View className="flex-1 bg-black/40 p-5 justify-center">
            <View className="bg-white rounded-3xl p-5 w-full max-w-md self-center max-h-[85%]">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: '#7C3AED18' }}>
                    <FontAwesome6 name="q" size={15} color="#7C3AED" />
                  </View>
                  <View>
                    <Text className="text-base font-extrabold text-gray-900">抽查自测</Text>
                    <Text className="text-xs text-gray-400">{quizEvent?.title || ''}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setQuizModalVisible(false)}>
                  <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <ScrollView className="max-h-[500px]" style={{ gap: 10 }}>
                {quizLoading ? (
                  <Text className="text-gray-400 text-center py-8">AI 出题中，稍等…</Text>
                ) : quizzes.length === 0 ? (
                  <Text className="text-gray-400 text-center py-8">暂无抽查题，去日程标记「需抽查」后重试</Text>
                ) : (
                  quizzes.map((q, i) => (
                    <View key={q.id} className="rounded-2xl p-4" style={{ backgroundColor: '#F7F5F0' }}>
                      <View className="flex-row items-start gap-2">
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: '#7C3AED18' }}>
                          <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
                        </View>
                        <Text className="flex-1 text-sm font-semibold text-gray-800">{q.question}</Text>
                      </View>
                      {q.hint ? (<Text className="text-xs text-amber-700 mt-1 ml-8">提示：{q.hint}</Text>) : null}
                      {reveal[q.id] ? (
                        <View className="rounded-xl p-2.5 mt-2 ml-8" style={{ backgroundColor: '#05966914' }}>
                          <Text className="text-sm text-emerald-800"><Text className="font-bold">答案：</Text>{q.answer}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setReveal((r) => ({ ...r, [q.id]: true }))}
                          className="self-start mt-2 ml-8 px-3 py-1 rounded-full"
                          style={{ backgroundColor: '#7C3AED18' }}
                        >
                          <Text style={{ color: '#7C3AED', fontSize: 12, fontWeight: '700' }}>先自测，再看答案</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}
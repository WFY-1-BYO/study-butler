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
import { api } from '@/utils/api';
import { KnowledgeItem } from '@/utils/types';

const SUBJECT_COLORS = ['#3730A3', '#0EA5E9', '#EA580C', '#059669', '#9333EA', '#DB2777', '#CA8A04', '#64748B'];

interface SubjectWithStats {
  id: number;
  name: string;
  color: string;
  current_progress: string | null;
  event_count: number;
  material_count: number;
  progress: number;
}

interface Material {
  id: number;
  subject_id: number;
  week_no: number;
  topic: string;
  title: string;
  created_at: string;
}

export default function StudyScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [genModal, setGenModal] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [generating, setGenerating] = useState(false);
  // AI 备料表单
  const [genSubjectId, setGenSubjectId] = useState<number | null>(null);
  const [genWeek, setGenWeek] = useState('1');
  const [genTopic, setGenTopic] = useState('');
  // 我的资料（知识库）表单
  const [knowModal, setKnowModal] = useState(false);
  const [knowSubjectId, setKnowSubjectId] = useState<number | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [knowTitle, setKnowTitle] = useState('');
  const [knowContent, setKnowContent] = useState('');
  const [knowLoading, setKnowLoading] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get<SubjectWithStats[]>('/api/v1/subjects/with-stats');
      setSubjects(data || []);
      const c = await api.get<Record<number, number>>('/api/v1/knowledge/count');
      setCounts(c || {});
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleAdd = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: '请填写学科名称' });
      return;
    }
    try {
      await api.post('/api/v1/subjects', { name: name.trim(), color });
      setAddModal(false);
      setName('');
      Toast.show({ type: 'success', text1: '已添加学科' });
      fetchData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '添加失败', text2: e.message });
    }
  };

  const openGen = (subjectId: number) => {
    setGenSubjectId(subjectId);
    setGenTopic('');
    setGenModal(true);
  };

  const handleGenerate = async () => {
    if (!genSubjectId || !genTopic.trim()) {
      Toast.show({ type: 'error', text1: '请选择学科并填写主题' });
      return;
    }
    try {
      setGenerating(true);
      await api.post('/api/v1/ai/material', {
        subject_id: genSubjectId,
        week_no: Number(genWeek) || 1,
        topic: genTopic.trim(),
      });
      setGenModal(false);
      Toast.show({ type: 'success', text1: 'AI 备料完成', text2: '已在资料库生成知识点+10题' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '生成失败', text2: e.message });
    } finally {
      setGenerating(false);
    }
  };

  // 打开"我的资料"管理弹窗
  const openKnowledge = async (subjectId: number) => {
    setKnowSubjectId(subjectId);
    setKnowTitle('');
    setKnowContent('');
    setKnowModal(true);
    setKnowLoading(true);
    try {
      const list = await api.get<KnowledgeItem[]>(`/api/v1/knowledge?subject_id=${subjectId}`);
      setKnowledgeList(list || []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '加载资料失败', text2: e.message });
      setKnowledgeList([]);
    } finally {
      setKnowLoading(false);
    }
  };

  const handleAddKnowledge = async () => {
    if (!knowSubjectId || !knowTitle.trim() || !knowContent.trim()) {
      Toast.show({ type: 'error', text1: '请填写标题和内容' });
      return;
    }
    try {
      await api.post('/api/v1/knowledge', {
        subject_id: knowSubjectId,
        title: knowTitle.trim(),
        content: knowContent.trim(),
      });
      setKnowTitle('');
      setKnowContent('');
      await openKnowledge(knowSubjectId);
      Toast.show({ type: 'success', text1: '已存入 AI 记忆库', text2: '之后出题会基于它' });
      fetchData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '存入失败', text2: e.message });
    }
  };

  const handleDeleteKnowledge = async (id: number) => {
    try {
      await api.delete(`/api/v1/knowledge/${id}`);
      if (knowSubjectId) await openKnowledge(knowSubjectId);
      fetchData();
      Toast.show({ type: 'success', text1: '已删除' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '删除失败', text2: e.message });
    }
  };

  // 平板：选出当前需要备料的"周"，这里简化，按当前自然周
  const currentWeek = useCallback(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
    return week;
  }, []);

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']} statusBarStyle="auto">
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-4 pb-3">
          <View>
            <Text className="text-2xl font-extrabold text-gray-900">学习</Text>
            <Text className="text-xs text-gray-400">管理学科和进度，AI 帮你备料</Text>
          </View>
          <TouchableOpacity
            onPress={() => setAddModal(true)}
            className="w-11 h-11 rounded-2xl items-center justify-center"
            style={{ backgroundColor: '#3730A3' }}
          >
            <FontAwesome6 name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

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
          {/* 当前周备料建议 */}
          <View className="rounded-3xl p-5 mb-4 border border-orange-100" style={{ backgroundColor: '#FFF7ED' }}>
            <View className="flex-row items-center gap-2 mb-1">
              <FontAwesome6 name="lightbulb" size={16} color="#EA580C" />
              <Text className="font-bold text-orange-900">本周（第 {currentWeek()} 周）备料</Text>
            </View>
            <Text className="text-sm text-orange-700 leading-5">
              把教材/讲义先「录入资料」，AI 出题就会基于它们，而不是凭空编。
            </Text>
            <Text className="text-sm text-orange-600/70 leading-5 mt-1">
              点任一学科卡右上角的书本图标录入；再点魔棒即可基于你的资料生成「知识点 + 10 题 + 错因 + 易错点」。
            </Text>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: isTablet ? 14 : 10 }}>
            {subjects.length === 0 ? (
              <View className="w-full py-16 items-center">
                <FontAwesome6 name="book-open" size={40} color="#D1D5DB" />
                <Text className="text-gray-400 mt-4 text-center">添加你的学科（物理、英语、数学…）</Text>
              </View>
            ) : (
              subjects.map((s) => (
                <View key={s.id} className="rounded-3xl p-5 mb-1" style={[
                  { width: isTablet ? '48.5%' : '100%', backgroundColor: '#FFFFFF' },
                  { shadowColor: s.color, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
                ]}>
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <View className="w-4 h-4 rounded-md" style={{ backgroundColor: s.color }} />
                      <Text className="text-lg font-extrabold text-gray-900">{s.name}</Text>
                      {counts[s.id] ? (
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#05966918' }}>
                          <Text style={{ color: '#059669', fontSize: 11, fontWeight: '700' }}>AI 已记 {counts[s.id]} 条</Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => openKnowledge(s.id)}
                        className="w-9 h-9 rounded-xl items-center justify-center"
                        style={{ backgroundColor: '#F3F4F6' }}
                      >
                        <FontAwesome6 name="book-medical" size={15} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openGen(s.id)}
                        className="w-9 h-9 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${s.color}18` }}
                      >
                        <FontAwesome6 name="wand-magic-sparkles" size={15} color={s.color} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 进度条 */}
                  <View className="h-2 rounded-full bg-gray-100 mb-2 overflow-hidden">
                    <View className="h-full rounded-full" style={{ backgroundColor: s.color, width: `${s.progress}%` }} />
                  </View>
                  <Text className="text-xs text-gray-400 mb-2">
                    {s.current_progress || '还未记录当前进度'}
                  </Text>

                  <View className="flex-row gap-2">
                    <View className="flex-1 rounded-2xl py-2 items-center" style={{ backgroundColor: '#F7F5F0' }}>
                      <Text className="text-sm font-bold text-gray-800">{s.event_count}</Text>
                      <Text className="text-xs text-gray-400">日程</Text>
                    </View>
                    <View className="flex-1 rounded-2xl py-2 items-center" style={{ backgroundColor: '#F7F5F0' }}>
                      <Text className="text-sm font-bold text-gray-800">{s.material_count}</Text>
                      <Text className="text-xs text-gray-400">资料</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* 添加学科 Modal */}
        <Modal visible={addModal} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="flex-1 bg-black/40 p-5 justify-center">
                <View className="bg-white rounded-3xl p-5 w-full max-w-md self-center">
                  <Text className="text-lg font-extrabold text-gray-900 mb-4">添加学科</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="学科名称（物理、英语、数学…）"
                    placeholderTextColor="#9CA3AF"
                    className="rounded-2xl px-4 py-3 text-gray-900 mb-4"
                    style={{ backgroundColor: '#F3F4F6' }}
                  />
                  <Text className="text-xs font-bold text-gray-500 mb-2">选择颜色</Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {SUBJECT_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setColor(c)}
                        className="w-9 h-9 rounded-xl items-center justify-center"
                        style={{ backgroundColor: color === c ? `${c}26` : '#F3F4F6' }}
                      >
                        <FontAwesome6 name="circle" size={18} color={c} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => setAddModal(false)}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      <Text className="text-gray-600 font-bold">取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAdd}
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

        {/* AI 备料 Modal */}
        <Modal visible={genModal} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="flex-1 bg-black/40 p-5 justify-center">
                <View className="bg-white rounded-3xl p-5 w-full max-w-md self-center">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-extrabold text-gray-900">AI 私教备料</Text>
                    <TouchableOpacity onPress={() => setGenModal(false)} disabled={generating}>
                      <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  <Text className="text-xs font-bold text-gray-500 mb-1">学科</Text>
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {subjects.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setGenSubjectId(s.id)}
                        className="px-3 py-2 rounded-full"
                        style={{ backgroundColor: genSubjectId === s.id ? `${s.color}26` : '#F3F4F6' }}
                      >
                        <Text style={{ color: genSubjectId === s.id ? s.color : '#6B7280', fontWeight: '600', fontSize: 12 }}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-xs font-bold text-gray-500 mb-1">第几周</Text>
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {['1', '2', '3', '4', '5', '6'].map((w) => (
                      <TouchableOpacity
                        key={w}
                        onPress={() => setGenWeek(w)}
                        className="px-3 py-2 rounded-full"
                        style={{ backgroundColor: genWeek === w ? '#3730A318' : '#F3F4F6' }}
                      >
                        <Text style={{ color: genWeek === w ? '#3730A3' : '#6B7280', fontWeight: '600', fontSize: 12 }}>第{w}周</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-xs font-bold text-gray-500 mb-1">主题</Text>
                  <TextInput
                    value={genTopic}
                    onChangeText={setGenTopic}
                    placeholder="比如：受力分析 / 现在完成时"
                    placeholderTextColor="#9CA3AF"
                    className="rounded-2xl px-4 py-3 text-gray-900 mb-4"
                    style={{ backgroundColor: '#F3F4F6' }}
                  />

                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => setGenModal(false)}
                      disabled={generating}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      <Text className="text-gray-600 font-bold">取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleGenerate}
                      disabled={generating}
                      className="flex-[2] py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#EA580C' }}
                    >
                      <Text className="text-white font-bold">{generating ? '生成中…' : '生成资料'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>

        {/* 我的资料（AI 记忆库）Modal */}
        <Modal visible={knowModal} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="flex-1 bg-black/40 p-5 justify-center">
                <View className="bg-white rounded-3xl p-5 w-full max-w-lg self-center max-h-[85%]">
                  <View className="flex-row items-center justify-between mb-2">
                    <View>
                      <Text className="text-lg font-extrabold text-gray-900">我的资料</Text>
                      <Text className="text-xs text-gray-400">
                        AI 出题/备料会严格基于这些内容（基于教材，不凭空编）
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setKnowModal(false)}>
                      <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  {/* 已录入列表 */}
                  <ScrollView className="flex-shrink" style={{ maxHeight: 200 }}>
                    {knowLoading ? (
                      <Text className="text-gray-400 text-sm py-3">加载中…</Text>
                    ) : knowledgeList.length === 0 ? (
                      <View className="py-4 items-center">
                        <Text className="text-gray-400 text-sm text-center">还没有资料，在下方粘贴你的讲义 / 笔记</Text>
                      </View>
                    ) : (
                      knowledgeList.map((k) => (
                        <View key={k.id} className="flex-row items-center gap-2 py-2 border-b border-gray-100">
                          <View className="flex-1">
                            <Text className="text-sm font-bold text-gray-800">{k.title}</Text>
                            <Text className="text-xs text-gray-400 line-clamp-1" numberOfLines={1}>{k.content}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteKnowledge(k.id)}
                            className="w-8 h-8 rounded-lg items-center justify-center"
                            style={{ backgroundColor: '#DC262618' }}
                          >
                            <FontAwesome6 name="trash-can" size={13} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </ScrollView>

                  {/* 录入表单 */}
                  <Text className="text-xs font-bold text-gray-500 mb-1 mt-3">标题（如：摩擦力 F=μN）</Text>
                  <TextInput
                    value={knowTitle}
                    onChangeText={setKnowTitle}
                    placeholder="这段资料的名称"
                    placeholderTextColor="#9CA3AF"
                    className="rounded-2xl px-4 py-3 text-gray-900 mb-2"
                    style={{ backgroundColor: '#F3F4F6' }}
                  />
                  <Text className="text-xs font-bold text-gray-500 mb-1">内容（讲义 / 笔记 / 公式 / 定义）</Text>
                  <TextInput
                    value={knowContent}
                    onChangeText={setKnowContent}
                    placeholder="把教材、老师的讲义、你的笔记粘到这里，AI 会记住并据此出题"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    className="rounded-2xl px-4 py-3 text-gray-900 mb-3"
                    style={{ backgroundColor: '#F3F4F6', minHeight: 90, textAlignVertical: 'top' }}
                  />
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => setKnowModal(false)}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      <Text className="text-gray-600 font-bold">完成</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddKnowledge}
                      className="flex-[2] py-3 rounded-2xl items-center"
                      style={{ backgroundColor: '#059669' }}
                    >
                      <Text className="text-white font-bold">存入 AI 记忆库</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </Screen>
  );
}
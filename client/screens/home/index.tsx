import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import dayjs from 'dayjs';

import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import {
  Subject,
  Event,
  PlanTask,
  formatAbs,
  formatDate,
  daysBetween,
  typeLabel,
} from '@/utils/types';
import { useSafeRouter } from '@/hooks/useSafeRouter';

// ---------- 子组件：倒计时里程碑 ----------
function CountdownChip({ days }: { days: number }) {
  const color = days <= 1 ? '#DC2626' : days <= 3 ? '#EA580C' : '#059669';
  const label = days <= 0 ? '就在今天' : `还有 ${days} 天`;
  return (
    <View
      className="px-3 py-1 rounded-full"
      style={{ backgroundColor: `${color}18`, alignSelf: 'flex-start' }}
    >
      <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </View>
  );
}

// ---------- 子组件：今日必修卡 ----------
function MustCard({
  headline,
  mustDo,
  fallback,
}: {
  headline: string;
  mustDo: string;
  fallback: string;
}) {
  return (
    <View className="rounded-3xl p-5 mb-5 border border-indigo-100"
      style={{ backgroundColor: '#FFFFFF', shadowColor: '#3730A3', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: '#3730A318' }}>
          <FontAwesome6 name="bolt" size={15} color="#3730A3" />
        </View>
        <Text className="text-sm font-bold text-indigo-900">今日必做</Text>
      </View>
      {headline ? <Text className="text-lg font-extrabold text-gray-900 mb-1">{headline}</Text> : null}
      <Text className="text-base text-gray-800 leading-6 mb-3">{mustDo}</Text>
      <View className="rounded-2xl p-3" style={{ backgroundColor: '#05966912' }}>
        <Text className="text-xs font-bold text-emerald-700 mb-0.5" style={{ fontSize: 12 }}>
          <FontAwesome6 name="shield-heart" size={11} color="#059669" /> 如果只能做 10 分钟
        </Text>
        <Text className="text-sm text-emerald-800 leading-5">{fallback}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [upcoming, setUpcoming] = useState<Event[]>([]);
  const [todayTasks, setTodayTasks] = useState<PlanTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<{
        today: Event[];
        upcoming: (Event & { days_left: number })[];
      }>('/api/v1/events/today');
      setTodayEvents(res.today || []);
      setUpcoming(res.upcoming || []);

      const todayStr = dayjs().format('YYYY-MM-DD');
      const tasks = await api.get<PlanTask[]>(`/api/v1/plan-tasks?date=${todayStr}`);
      setTodayTasks(tasks || []);
      const subs = await api.get<Subject[]>('/api/v1/subjects');
      setSubjects(subs || []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const subjectById = (id: number | null) => subjects.find((s) => s.id === id);

  const openTasks = todayTasks.filter((t) => !t.done);
  const mustDo = openTasks.length > 0 ? openTasks[0] : null;
  const fallbackTask =
    openTasks.find((t) => t.is_fallback) || openTasks[openTasks.length - 1];

  const topEvent: Event & { days_left?: number } | null =
    upcoming.find((e) => !e.done) || todayEvents.find((e) => !e.done) || null;

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']} statusBarStyle="auto">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isTablet ? 32 : 16,
          maxWidth: isTablet ? 720 : undefined,
          width: isTablet ? '100%' : undefined,
          alignSelf: 'center',
          paddingBottom: 40,
        }}
      >
        {/* Header */}
        <View className="mb-5">
          <Text className="text-xs text-gray-500 mb-1" style={{ fontSize: 13 }}>
            {dayjs().format('dddd, M月D日')}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-extrabold text-gray-900">你的今日看板</Text>
            <TouchableOpacity
              onPress={() => router.push('/schedule')}
              className="w-10 h-10 rounded-2xl items-center justify-center"
              style={{ backgroundColor: '#3730A318' }}
            >
              <FontAwesome6 name="plus" size={18} color="#3730A3" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 今日必修卡 */}
        <MustCard
          headline={topEvent ? `距「${topEvent.title}」${`${topEvent.days_left ?? 0}`} 天` : ''}
          mustDo={mustDo ? `${mustDo.task}（${mustDo.minutes} 分钟）` : '今天暂无计划任务，去日程里添加一个吧'}
          fallback={fallbackTask ? `只做：${fallbackTask.task}` : '放松一下，给自己留点余地'}
        />

        {/* 今日任务进度（平板双栏 / 手机单列） */}
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <View className="rounded-3xl p-5 mb-1 flex-1 min-w-[240px]" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <Text className="text-sm font-bold text-gray-700 mb-3">今天要做的</Text>
            {todayTasks.length === 0 ? (
              <Text className="text-gray-400 text-sm">暂无安排</Text>
            ) : (
              todayTasks.map((t) => {
                const done = t.done;
                return (
                  <View key={t.id} className="flex-row items-start gap-2 py-1.5">
                    <View className={`w-5 h-5 rounded-full items-center justify-center ${done ? 'bg-emerald-500' : 'border-2 border-gray-300'}`}>
                      {done ? <FontAwesome6 name="check" size={10} color="#fff" /> : null}
                    </View>
                    <Text className={`flex-1 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {t.task}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* 近期事件 */}
          <View className="rounded-3xl p-5 mb-1 flex-1 min-w-[240px]" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <Text className="text-sm font-bold text-gray-700 mb-3">近期里程碑</Text>
            {upcoming.length === 0 && todayEvents.length === 0 ? (
              <Text className="text-gray-400 text-sm">暂无事件</Text>
            ) : (
              [...todayEvents, ...upcoming].slice(0, 5).map((e) => {
                const days = daysBetween(new Date(), new Date(e.start_at));
                const subj = subjectById(e.subject_id);
                return (
                  <TouchableOpacity
                    key={e.id}
                    className="flex-row items-center gap-2 py-1.5"
                    onPress={() =>
                      router.push('/schedule', { focus: 'detail', id: e.id })
                    }
                  >
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: subj?.color || '#9CA3AF' }} />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-800 flex-shrink">{e.title}</Text>
                      <Text className="text-xs text-gray-400">{formatAbs(e.start_at)} · {typeLabel(e.type)}</Text>
                    </View>
                    <CountdownChip days={days} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* 学科进度 */}
        {subjects.length > 0 && (
          <View className="mt-4 rounded-3xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <Text className="text-sm font-bold text-gray-700 mb-3">我的学科</Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => router.push('/study', { subject: s.id })}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: `${s.color}16` }}
                >
                  <Text style={{ color: s.color, fontWeight: '700', fontSize: 14 }}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text className="text-center text-gray-400 mt-6" style={{ fontSize: 12 }}>
          {loading ? '加载中…' : `今日 ${todayTasks.filter((t) => t.done).length}/${todayTasks.length} 完成`}
        </Text>
      </ScrollView>
    </Screen>
  );
}
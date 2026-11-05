import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Subject } from '@/utils/types';

interface MaterialItem {
  id: number;
  subject_id: number;
  week_no: number;
  topic: string;
  title: string;
  ai_generated: boolean;
  source: string | null;
  created_at: string;
  subjects: { name: string; color: string } | null;
}

export default function MaterialsScreen() {
  const router = useSafeRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const path =
        activeFilter === null ? '/api/v1/materials' : `/api/v1/materials?subject_id=${activeFilter}`;
      const data = await api.get<MaterialItem[]>(path);
      setMaterials(data || []);
      const subs = await api.get<Subject[]>('/api/v1/subjects');
      setSubjects(subs || []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
    }
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']} statusBarStyle="auto">
      <View className="flex-1">
        <View className="px-4 pb-2">
          <Text className="text-2xl font-extrabold text-gray-900">资料库</Text>
          <Text className="text-xs text-gray-400">AI 备料自动归档，按学科查看</Text>
        </View>

        {/* 学科筛选（可横向滚动） */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 pb-2"
            contentContainerStyle={{ gap: 8 }}
          >
          <TouchableOpacity
            onPress={() => setActiveFilter(null)}
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: activeFilter === null ? '#3730A3' : '#F3F4F6' }}
          >
            <Text style={{ color: activeFilter === null ? '#fff' : '#6B7280', fontWeight: '700', fontSize: 13 }}>全部</Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setActiveFilter(s.id)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: activeFilter === s.id ? s.color : '#F3F4F6' }}
            >
              <Text style={{ color: activeFilter === s.id ? '#fff' : '#6B7280', fontWeight: '700', fontSize: 13 }}>{s.name}</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
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
          <View className="flex-row flex-wrap" style={{ gap: isTablet ? 14 : 10 }}>
            {materials.length === 0 ? (
              <View className="w-full py-16 items-center">
                <FontAwesome6 name="folder-open" size={40} color="#D1D5DB" />
                <Text className="text-gray-400 mt-4 text-center">
                  还没有资料
                </Text>
                <Text className="text-gray-300 text-sm mt-1 text-center">
                  去「学习」页点生成按钮，让 AI 帮你备料
                </Text>
              </View>
            ) : (
              materials.map((m) => {
                const color = m.subjects?.color || '#4F46E5';
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => router.push('/material-detail', { id: m.id })}
                    className="rounded-3xl p-4 mb-1"
                    style={[
                      { width: isTablet ? '48.5%' : '100%', backgroundColor: '#FFFFFF' },
                      { shadowColor: color, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
                    ]}
                  >
                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <Text className="text-xs font-bold text-gray-500">
                        {m.subjects?.name || '未知学科'} · 第 {m.week_no} 周
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-gray-900 mb-1 flex-shrink">{m.topic || m.title}</Text>
                    {m.ai_generated && (
                      <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EA580C16' }}>
                        <View className="flex-row items-center gap-1">
                          <FontAwesome6 name="wand-magic-sparkles" size={9} color="#EA580C" />
                          <Text className="text-orange-700 text-xs" style={{ fontSize: 10 }}>AI 生成</Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}
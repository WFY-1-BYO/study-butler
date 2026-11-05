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

import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import { Material } from '@/utils/types';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';

export default function MaterialDetailScreen() {
  const router = useSafeRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { id } = useSafeSearchParams<{ id: number }>();

  const [material, setMaterial] = useState<Material | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const load = async () => {
        try {
          const data = await api.get<Material>(`/api/v1/materials/${id}`);
          setMaterial(data);
        } catch (e: any) {
          Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
        }
      };
      load();
    }, [id])
  );

  if (!material) {
    return (
      <Screen statusBarStyle="auto">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">加载中…</Text>
        </View>
      </Screen>
    );
  }

  const concepts = material.content?.concepts || [];
  const questions = material.content?.questions || [];
  const answers = material.content?.answers || [];
  const pitfall = material.content?.pitfall || '';

  const levelColor = (level: string) => {
    if (level === '难') return '#DC2626';
    if (level === '中') return '#EA580C';
    return '#059669';
  };

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']} statusBarStyle="auto">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 gap-2">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
            <FontAwesome6 name="arrow-left" size={16} color="#374151" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-900 flex-1" numberOfLines={1}>
            {material.topic || material.title}
          </Text>
          <TouchableOpacity onPress={() => router.navigate('/materials')} className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
            <FontAwesome6 name="folder-open" size={15} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 16,
            maxWidth: isTablet ? 760 : undefined,
            width: isTablet ? '100%' : undefined,
            alignSelf: 'center',
            paddingBottom: 40,
          }}
        >
          {/* 核心概念 */}
          <Text className="text-lg font-extrabold text-gray-900 mb-2">
            <FontAwesome6 name="lightbulb" size={16} color="#EA580C" /> 核心概念
          </Text>
          <View style={{ gap: 10 }} className="mb-5">
            {concepts.length === 0 ? (
              <Text className="text-gray-400 text-sm">无知识点</Text>
            ) : (
              concepts.map((c, i) => (
                <View key={i} className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED' }}>
                  <Text className="font-bold text-orange-900 mb-1">{i + 1}. {c.title}</Text>
                  <Text className="text-sm text-orange-800 leading-5">{c.desc}</Text>
                </View>
              ))
            )}
          </View>

          {/* 10 道题 */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-extrabold text-gray-900">
              <FontAwesome6 name="list-check" size={16} color="#3730A3" /> 配套练习（10 题）
            </Text>
            <TouchableOpacity
              onPress={() => setShowAnswers(!showAnswers)}
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#3730A316' }}
            >
              <Text className="text-indigo-900 font-bold" style={{ fontSize: 12 }}>
                {showAnswers ? '隐藏答案' : '显示答案'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }} className="mb-5">
            {questions.length === 0 ? (
              <Text className="text-gray-400 text-sm">无题目</Text>
            ) : (
              questions.map((q, i) => {
                const ans = answers.find((a) => a.index === i);
                return (
                  <View key={i} className="rounded-2xl p-4" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
                    <View className="flex-row items-center gap-2 mb-2">
                      <Text className="text-sm font-bold text-gray-500">Q{i + 1}</Text>
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${levelColor(q.level)}16` }}>
                        <Text style={{ color: levelColor(q.level), fontSize: 11, fontWeight: '700' }}>{q.level}</Text>
                      </View>
                    </View>
                    <Text className="text-sm text-gray-800 leading-6">{q.content}</Text>
                    {showAnswers && ans && (
                      <View className="mt-3 rounded-2xl p-3" style={{ backgroundColor: '#0596690D', borderLeftWidth: 3, borderLeftColor: '#059669' }}>
                        <Text className="text-sm font-bold text-emerald-800 mb-1">答案：{ans.answer}</Text>
                        <Text className="text-xs text-gray-600 leading-5">错因：{ans.reason}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* 易错点 */}
          {pitfall ? (
            <View className="rounded-3xl p-5 border border-red-100" style={{ backgroundColor: '#FEF2F2' }}>
              <Text className="font-bold text-red-800 mb-1.5" style={{ fontSize: 15 }}>
                <FontAwesome6 name="triangle-exclamation" size={14} color="#DC2626" /> 这节最容易错的地方
              </Text>
              <Text className="text-sm text-red-700 leading-6">{pitfall}</Text>
            </View>
          ) : null}

          <Text className="text-center text-gray-300 mt-6" style={{ fontSize: 11 }}>
            {material.source || 'AI 生成，需自行核对'}
          </Text>
        </ScrollView>
      </View>
    </Screen>
  );
}
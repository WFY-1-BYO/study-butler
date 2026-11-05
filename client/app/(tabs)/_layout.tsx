import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCSSVariable } from 'uniwind';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  let tabBarStyle: Record<string, string | number | undefined> = {
    backgroundColor: background,
    borderTopWidth: 1,
    borderTopColor: border,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="table-cells" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '日程',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="calendar-days" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: '学习',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="book-open" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="materials"
        options={{
          title: '资料库',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="folder-open" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
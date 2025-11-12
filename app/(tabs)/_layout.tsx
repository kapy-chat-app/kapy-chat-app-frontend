import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TabLayout() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';

  const colors = {
    light: {
      tabBar: '#F8F8F8',
      active: '#FF8C42',
      inactive: '#8E8E93',
    },
    dark: {
      tabBar: '#1C1C1E',
      active: '#FF8C42',
      inactive: '#8E8E93',
    }
  };

  const currentColors = isDark ? colors.dark : colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: currentColors.tabBar,
          borderTopWidth: 0,
          paddingBottom: 20,
          paddingTop: 10,
          height: 80,
        },
        tabBarActiveTintColor: currentColors.active,
        tabBarInactiveTintColor: currentColors.inactive,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: t('tabs.conversations'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: t('tabs.contacts'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'people' : 'people-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
       <Tabs.Screen
        name="emotion"
        options={{
          title: t('tabs.emotion'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'sparkles' : 'sparkles-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: t('tabs.ai'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'sparkles' : 'sparkles-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: t('tabs.setting'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'person-circle-outline' : 'person-circle'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
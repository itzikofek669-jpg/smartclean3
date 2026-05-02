import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useLanguage } from './LanguageContext';

export default function BottomTabBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { t }    = useLanguage();

  const tabs = [
    { route: '/home',     icon: '🏠', label: t.navHome     || 'ראשי'   },
    { route: '/messages', icon: '💬', label: t.navMessages || 'הודעות' },
    { route: '/profile',  icon: '👤', label: t.navProfile  || 'פרופיל' },
  ] as const;

  return (
    <View style={s.bar}>
      {tabs.map(tab => {
        const active = pathname === tab.route || pathname.startsWith(tab.route + '?');
        return (
          <TouchableOpacity
            key={tab.route}
            style={s.tab}
            onPress={() => {
              if (!active) router.replace(tab.route);
            }}
            activeOpacity={0.7}
          >
            <Text style={[s.icon, active && s.iconActive]}>{tab.icon}</Text>
            <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
            {active && <View style={s.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const C = {
  blue:      '#185FA5',
  blueLight: '#E6F1FB',
  border:    '#B5D4F4',
  text:      '#6B9DC2',
  white:     '#FFFFFF',
};

const s = StyleSheet.create({
  bar: {
    flexDirection:   'row',
    backgroundColor: C.white,
    borderTopWidth:  1,
    borderTopColor:  C.border,
    paddingBottom:   Platform.OS === 'ios' ? 20 : 8,
    paddingTop:      8,
    elevation:       12,
    shadowColor:     '#185FA5',
    shadowOpacity:   0.08,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: -2 },
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,
    position:       'relative',
  },
  icon:        { fontSize: 22 },
  iconActive:  { fontSize: 24 },
  label:       { fontSize: 11, color: C.text, fontWeight: '600' },
  labelActive: { color: C.blue, fontWeight: '800' },
  dot: {
    position:        'absolute',
    bottom:          -6,
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: C.blue,
  },
});

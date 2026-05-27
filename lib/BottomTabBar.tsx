import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage, T, useAppColors, AppColors } from './LanguageContext';

export const TAB_BAR_CONTENT_HEIGHT = 56;

function createS(c: AppColors, paddingBottom: number) {
  return StyleSheet.create({
    bar: {
      flexDirection:   'row',
      backgroundColor: c.white,
      borderTopWidth:  1,
      borderTopColor:  c.blueBorder,
      paddingBottom,
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
    label:       { fontSize: 11, color: c.textSub, fontWeight: '600' },
    labelActive: { color: c.blue, fontWeight: '800' },
    dot: {
      position:        'absolute',
      bottom:          -6,
      width:           4,
      height:          4,
      borderRadius:    2,
      backgroundColor: c.blue,
    },
  });
}

export const TAB_BAR_CONTENT_HEIGHT = 60;

export default function BottomTabBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { t, flipSide } = useLanguage();
  const C = useAppColors();
  const insets = useSafeAreaInsets();
  const s = createS(C, insets.bottom + 8);

  const tabs = [
    { route: '/home',     icon: '🏠', label: t.navHome     || 'ראשי'   },
    { route: '/messages', icon: '💬', label: t.navMessages || 'הודעות' },
    { route: '/profile',  icon: '👤', label: t.navProfile  || 'פרופיל' },
  ] as const;

  const orderedTabs = flipSide ? [...tabs].reverse() : tabs;

  return (
    <View style={[s.bar, flipSide && { flexDirection: 'row-reverse' }]}>
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
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <T style={[s.icon, active && s.iconActive]}>{tab.icon}</T>
            <T style={[s.label, active && s.labelActive]}>{tab.label}</T>
            {active && <View style={s.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


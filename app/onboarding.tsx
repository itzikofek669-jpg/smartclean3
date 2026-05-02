import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList,
  TouchableOpacity, SafeAreaView, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useLanguage } from '../lib/LanguageContext';

const { width: W, height: H } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🧹',
    bg: '#EFF6FF',
    accent: '#185FA5',
    dot: '#185FA5',
    titleKey: 'onboarding1Title',
    subKey:   'onboarding1Sub',
  },
  {
    emoji: '📅',
    bg: '#F0FDF4',
    accent: '#059669',
    dot: '#059669',
    titleKey: 'onboarding2Title',
    subKey:   'onboarding2Sub',
  },
  {
    emoji: '⭐',
    bg: '#FFFBEB',
    accent: '#D97706',
    dot: '#D97706',
    titleKey: 'onboarding3Title',
    subKey:   'onboarding3Sub',
  },
];

export default function OnboardingScreen() {
  const router  = useRouter();
  const { t }   = useLanguage();
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const finish = async () => {
    await SecureStore.setItemAsync('onboarding_done', '1');
    router.replace('/');
  };

  const goTo = (idx: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setCurrent(idx);
    listRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) goTo(current + 1);
    else finish();
  };

  const slide = SLIDES[current];

  return (
    <SafeAreaView style={[s.wrap, { backgroundColor: slide.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={slide.bg} />

      {/* Skip */}
      <TouchableOpacity style={s.skipBtn} onPress={finish}>
        <Text style={s.skipTxt}>{t.onboardingSkip}</Text>
      </TouchableOpacity>

      {/* Slides (hidden scroll, we animate via state) */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        style={{ flex: 0 }}
        renderItem={({ item }) => (
          <View style={{ width: W, alignItems: 'center' }}>
            {/* empty, content rendered below */}
          </View>
        )}
      />

      {/* Animated content */}
      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        <Text style={s.emoji}>{slide.emoji}</Text>
        <Text style={[s.title, { color: slide.accent }]}>{(t as any)[slide.titleKey]}</Text>
        <Text style={s.sub}>{(t as any)[slide.subKey]}</Text>
      </Animated.View>

      {/* Bottom */}
      <View style={s.bottom}>
        {/* Dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((sl, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <Animated.View
                style={[
                  s.dot,
                  i === current
                    ? [s.dotActive, { backgroundColor: sl.dot }]
                    : s.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next / Start */}
        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: slide.accent }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={s.nextTxt}>
            {current === SLIDES.length - 1 ? t.onboardingStart : `${t.onboardingNext} →`}
          </Text>
        </TouchableOpacity>

        {/* CLEANTOUCH branding */}
        <Text style={s.brand}>CLEANTOUCH</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap:    { flex: 1 },
  skipBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  skipTxt: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 20 },
  emoji:   { fontSize: H > 700 ? 100 : 80 },
  title:   { fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 34 },
  sub:     { fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 26, maxWidth: 300 },
  bottom:  { paddingHorizontal: 32, paddingBottom: 40, alignItems: 'center', gap: 20 },
  dotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot:     { height: 8, borderRadius: 4 },
  dotActive:  { width: 24 },
  dotInactive:{ width: 8, backgroundColor: '#CBD5E1' },
  nextBtn: { width: '100%', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  nextTxt: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  brand:   { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: -8 },
});

import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage, TextScale, HC, T } from './LanguageContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AccessibilityModal({ visible, onClose }: Props) {
  const { t, flipSide, setFlipSide, textScale, setTextScale, highContrast, setHighContrast } = useLanguage();
  const insets = useSafeAreaInsets();

  // צבעים דינמיים — מגיבים לניגודיות גבוהה
  const bg    = highContrast ? HC.card    : '#FFFFFF';
  const bgRow = highContrast ? HC.bg      : '#F8FAFC';
  const txt   = highContrast ? HC.text    : '#1E3A5F';
  const sub   = highContrast ? HC.sub     : '#64748B';
  const blue  = highContrast ? HC.blue    : '#2563EB';
  const border= highContrast ? HC.border  : '#E2EAF3';

  // גודל גופן דינמי
  const fs = (base: number) => Math.round(base * textScale);

  const Row = ({ icon, label, sublabel, right }: {
    icon: string; label: string; sublabel?: string; right: React.ReactNode
  }) => (
    <View style={[ms.row, { backgroundColor: bgRow, borderColor: border, borderWidth: highContrast ? 2 : 1 }]}>
      <T style={[ms.rowIcon, { fontSize: fs(22) }]}>{icon}</T>
      <View style={{ flex: 1 }}>
        <T style={[ms.rowLabel, { color: txt, fontSize: fs(15) }]}>{label}</T>
        {sublabel ? <T style={[ms.rowSub, { color: sub, fontSize: fs(12) }]}>{sublabel}</T> : null}
      </View>
      {right}
    </View>
  );

  const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[ms.toggle, { backgroundColor: value ? blue : (highContrast ? '#444' : '#CBD5E1') }]}
    >
      <View style={[ms.thumb, value && ms.thumbOn]} />
    </TouchableOpacity>
  );

  const SCALES: { v: TextScale; label: string }[] = [
    { v: 1,    label: 'A'  },
    { v: 1.15, label: 'A+' },
    { v: 1.3,  label: 'A++'},
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ms.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[ms.sheet, { backgroundColor: bg, borderColor: border, borderTopWidth: highContrast ? 2 : 0, paddingBottom: insets.bottom + 16 }]}>
        {/* handle */}
        <View style={[ms.handle, { backgroundColor: border }]} />

        <T style={[ms.title, { color: txt, fontSize: fs(18) }]}>♿ {t.accessibilityTitle || 'נגישות'}</T>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* מצב שמאלי */}
          <Row
            icon="✋"
            label={t.leftHandedMode || 'מצב שמאלי'}
            sublabel={t.leftHandedSub || 'מזיז כפתורים לצד שמאל'}
            right={<Toggle value={flipSide} onToggle={() => setFlipSide(!flipSide)} />}
          />

          {/* ניגודיות גבוהה */}
          <Row
            icon="🔲"
            label={t.highContrastLabel || 'ניגודיות גבוהה'}
            sublabel={t.highContrastSub || 'מגביר ניגוד צבעים לקריאה טובה יותר'}
            right={<Toggle value={highContrast} onToggle={() => setHighContrast(!highContrast)} />}
          />

          {/* גודל טקסט */}
          <View style={[ms.row, ms.scaleRow, { backgroundColor: bgRow, borderColor: border, borderWidth: highContrast ? 2 : 1 }]}>
            <T style={[ms.rowIcon, { fontSize: fs(22) }]}>Aa</T>
            <View style={{ flex: 1 }}>
              <T style={[ms.rowLabel, { color: txt, fontSize: fs(15) }]}>{t.textSizeLabel || 'גודל טקסט'}</T>
            </View>
            <View style={ms.scaleBtns}>
              {SCALES.map(sc => (
                <TouchableOpacity
                  key={sc.v}
                  onPress={() => setTextScale(sc.v)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: textScale === sc.v }}
                  style={[
                    ms.scaleBtn,
                    { borderColor: border },
                    textScale === sc.v && { backgroundColor: blue, borderColor: blue },
                  ]}
                >
                  <T style={[
                    ms.scaleBtnText,
                    {
                      color: textScale === sc.v ? '#FFF' : txt,
                      fontSize: (11 + SCALES.indexOf(sc) * 3) * textScale,
                    },
                  ]}>
                    {sc.label}
                  </T>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>

        <TouchableOpacity
          style={[ms.closeBtn, { borderColor: blue, backgroundColor: highContrast ? blue : 'transparent' }]}
          onPress={onClose}
        >
          <T style={[ms.closeBtnText, { color: highContrast ? '#FFF' : blue, fontSize: fs(15) }]}>
            {t.closeBtn || 'סגור'}
          </T>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, elevation: 20, maxHeight: '80%' },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  title:        { fontSize: 18, fontWeight: '800', textAlign: 'center', marginVertical: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1 },
  scaleRow:     { flexWrap: 'wrap' },
  rowIcon:      { fontSize: 22, width: 32, textAlign: 'center' },
  rowLabel:     { fontSize: 15, fontWeight: '700' },
  rowSub:       { fontSize: 12, marginTop: 2 },
  toggle:       { width: 48, height: 27, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 3 },
  thumb:        { width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', alignSelf: 'flex-start', elevation: 2 },
  thumbOn:      { alignSelf: 'flex-end' },
  scaleBtns:    { flexDirection: 'row', gap: 6 },
  scaleBtn:     { width: 44, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scaleBtnText: { fontWeight: '800' },
  closeBtn:     { marginTop: 8, borderRadius: 14, borderWidth: 2, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '700' },
});

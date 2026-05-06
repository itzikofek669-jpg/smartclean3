import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ScrollView, Platform,
} from 'react-native';
import { useLanguage, TextScale } from './LanguageContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AccessibilityModal({ visible, onClose }: Props) {
  const { t, flipSide, setFlipSide, textScale, setTextScale, highContrast, setHighContrast } = useLanguage();

  const bg    = '#FFFFFF';
  const bgRow = '#F8FAFC';
  const txt   = '#1E3A5F';
  const sub   = '#64748B';
  const blue  = '#2563EB';
  const border= '#E2EAF3';

  const Row = ({ icon, label, sublabel, right }: {
    icon: string; label: string; sublabel?: string; right: React.ReactNode
  }) => (
    <View style={[ms.row, { backgroundColor: bgRow, borderColor: border }]}>
      <Text style={ms.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[ms.rowLabel, { color: txt }]}>{label}</Text>
        {sublabel ? <Text style={[ms.rowSub, { color: sub }]}>{sublabel}</Text> : null}
      </View>
      {right}
    </View>
  );

  const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[ms.toggle, value && { backgroundColor: blue }]}
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
      <View style={[ms.sheet, { backgroundColor: bg }]}>
        {/* handle */}
        <View style={[ms.handle, { backgroundColor: border }]} />

        <Text style={[ms.title, { color: txt }]}>♿ {t.accessibilityTitle || 'נגישות'}</Text>

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
          <View style={[ms.row, ms.scaleRow, { backgroundColor: bgRow, borderColor: border }]}>
            <Text style={ms.rowIcon}>Aa</Text>
            <View style={{ flex: 1 }}>
              <Text style={[ms.rowLabel, { color: txt }]}>{t.textSizeLabel || 'גודל טקסט'}</Text>
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
                  <Text style={[
                    ms.scaleBtnText,
                    { color: textScale === sc.v ? '#FFF' : txt, fontSize: 11 + SCALES.indexOf(sc) * 2 },
                  ]}>
                    {sc.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>

        <TouchableOpacity style={[ms.closeBtn, { borderColor: border }]} onPress={onClose}>
          <Text style={[ms.closeBtnText, { color: blue }]}>{t.closeBtn || 'סגור'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, elevation: 20, maxHeight: '80%' },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  title:        { fontSize: 18, fontWeight: '800', textAlign: 'center', marginVertical: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1 },
  scaleRow:     { flexWrap: 'wrap' },
  rowIcon:      { fontSize: 22, width: 32, textAlign: 'center' },
  rowLabel:     { fontSize: 15, fontWeight: '700' },
  rowSub:       { fontSize: 12, marginTop: 2 },
  toggle:       { width: 48, height: 27, borderRadius: 14, backgroundColor: '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3 },
  thumb:        { width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', alignSelf: 'flex-start', elevation: 2 },
  thumbOn:      { alignSelf: 'flex-end' },
  scaleBtns:    { flexDirection: 'row', gap: 6 },
  scaleBtn:     { width: 40, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scaleBtnText: { fontWeight: '800' },
  closeBtn:     { marginTop: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '700' },
});

import React, { useState } from 'react';
import {
  View, TouchableOpacity, Modal, StyleSheet, ScrollView,
} from 'react-native';
import { T, useAppColors, useLanguage } from './LanguageContext';
import { SERVICE_ICONS, SERVICE_DESCRIPTIONS } from './serviceDescriptions';

interface Props {
  serviceKey: string;
  // מצב פיל — הכפתור עצמו הוא הפיל
  inlinePill?: boolean;
  label?: string;
  pillStyle?: any;
  pillTextStyle?: any;
  hideInfo?: boolean; // הסתר סימן ℹ, אבל הפיל עדיין לחיץ
  // כשמוגדר — לחיצה מפעילה את זה במקום לפתוח את פירוט השירות
  // (כרטיס מכווץ: לחיצה ראשונה מרחיבה, ורק במורחב לחיצה פותחת פירוט)
  onPressOverride?: () => void;
}

export default function ServiceInfoBtn({ serviceKey, inlinePill, label, pillStyle, pillTextStyle, hideInfo, onPressOverride }: Props) {
  const C = useAppColors();
  const [open, setOpen] = useState(false);
  const desc = SERVICE_DESCRIPTIONS[serviceKey];
  const icon = SERVICE_ICONS[serviceKey] || '🧹';

  // ─── מצב פיל מובנה ───────────────────────────────────────────────────────
  if (inlinePill) {
    return (
      <>
        <TouchableOpacity
          onPress={() => (onPressOverride ? onPressOverride() : setOpen(true))}
          style={[pillStyle, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
          accessibilityRole="button"
          accessibilityLabel={`${label} — לחץ לפרטים`}
        >
          {desc && !hideInfo && <T style={{ fontSize: 10, color: C.blue, fontWeight: '700' }}>ℹ </T>}
          <T style={pillTextStyle} numberOfLines={1}>{label}</T>
        </TouchableOpacity>

        {desc && (
          <InfoModal
            open={open}
            onClose={() => setOpen(false)}
            icon={icon}
            serviceKey={serviceKey}
            desc={desc}
          />
        )}
      </>
    );
  }

  // ─── מצב כפתור ℹ בלבד ───────────────────────────────────────────────────
  if (!desc) return null;
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={`פרטים על ${serviceKey}`}
      >
        <T style={[styles.icon, { color: C.blue }]}>ℹ</T>
      </TouchableOpacity>

      <InfoModal
        open={open}
        onClose={() => setOpen(false)}
        icon={icon}
        serviceKey={serviceKey}
        desc={desc}
      />
    </>
  );
}

// ─── Modal משותף ─────────────────────────────────────────────────────────────
function InfoModal({ open, onClose, icon, serviceKey, desc }: {
  open: boolean; onClose: () => void;
  icon: string; serviceKey: string; desc: string[];
}) {
  const C = useAppColors();
  const { t } = useLanguage();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={[styles.card, { backgroundColor: C.white, borderColor: C.blueBorder }]}>
            <View style={[styles.cardHeader, { backgroundColor: C.blue }]}>
              <T style={styles.cardTitle}>{icon} {serviceKey}</T>
            </View>
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {desc.map((line, i) => (
                <View key={i} style={styles.line}>
                  <T style={[styles.lineText, { color: C.textDark }]}>{line}</T>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: C.blue }]} onPress={onClose}>
              <T style={styles.closeBtnText}>{t.closeBtn}</T>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn:          { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  icon:         { fontSize: 14, fontWeight: '700', lineHeight: 16 },
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:         { width: 300, borderRadius: 18, overflow: 'hidden', borderWidth: 1, elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  cardHeader:   { paddingHorizontal: 16, paddingVertical: 12 },
  cardTitle:    { fontSize: 15, fontWeight: '900', color: '#fff', textAlign: 'center' },
  line:         { flexDirection: 'row', justifyContent: 'center' },
  lineText:     { fontSize: 13, lineHeight: 22, textAlign: 'center' },
  closeBtn:     { margin: 12, marginTop: 4, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

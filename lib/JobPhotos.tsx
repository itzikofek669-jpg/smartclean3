import React from 'react';
import { ActivityIndicator, Alert, Modal, Platform, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { T, useAppColors, useLanguage } from './LanguageContext';

// תמונות לעבודה — "ניקיון בזמן שלך" וניקיון דחוף.
//
// הלקוח בוחר מצלמה או גלריה, כמו בתמונת הפרופיל. קודם הייתה רק גלריה, ומי
// שעומד מול הבלגן ורוצה לצלם אותו היה צריך לצאת, לצלם, ולחזור.
//
// התמונה נשמרת כ-data URL על מסמך העבודה עצמו, ולכן נדחסת חזק: עד שלוש תמונות
// צריכות להיכנס יחד עם שאר המסמך מתחת למגבלה של Firestore (1MB למסמך).

export const JOB_PHOTOS_MAX = 3;

/**
 * A job's photos as a screen may show them: the compressed pictures this app
 * and the website write, three at most.
 *
 * The rules do not look inside the list, so a hand-written job could carry an
 * address on somebody's server — every provider opening the board would call
 * it, and be seen doing so — or megabytes of text. Anything that is not one of
 * our own data URLs is simply not shown.
 */
export function jobPhotosOf(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p): p is string => typeof p === 'string' && p.length <= 400_000 && /^data:image\/(jpeg|png|webp);base64,/.test(p))
    .slice(0, JOB_PHOTOS_MAX);
}

export type Source = 'camera' | 'library';

function askSource(t: any): Promise<Source | null> {
  return new Promise(resolve => {
    Alert.alert(
      t.jobPhotoSourceTitle ?? '📷 הוספת תמונה',
      '',
      [
        { text: t.cameraOption ?? '📷 מצלמה', onPress: () => resolve('camera') },
        { text: t.galleryOption ?? '🖼️ גלריה', onPress: () => resolve('library') },
        { text: t.cancel ?? 'ביטול', style: 'cancel', onPress: () => resolve(null) },
      ],
      // Android: tapping outside the dialog closes it without a button.
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/**
 * Camera or gallery, asked first, then the photo's local uri — or null when the
 * user cancelled or refused the permission (after saying so). The chats used
 * the gallery alone: Android's newer photo picker has no camera in it, so the
 * camera button there could no longer take a photo.
 */
export async function pickPhotoUri(t: any): Promise<string | null> {
  const source = await askSource(t);
  if (!source) return null;
  if (Platform.OS === 'ios') await new Promise(resolve => setTimeout(resolve, 400));
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t.error, source === 'camera' ? t.cameraPermDenied : t.galleryPermDenied);
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1, base64: false, exif: false,
  };
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync(opts)
    : await ImagePicker.launchImageLibraryAsync(opts);
  return res.canceled || !res.assets[0] ? null : res.assets[0].uri;
}

/**
 * One photo, taken or picked, as a compressed JPEG data URL — or null when the
 * user cancelled or it could not be read (after saying so).
 */
export async function pickJobPhoto(t: any, chosen?: Source): Promise<string | null> {
  const source = chosen ?? await askSource(t);
  if (!source) return null;
  // iOS: the question above is still sliding away when its button answers, and
  // a camera or gallery presented at that moment — from inside the form's own
  // sheet — can be dropped without a word. A beat lets it finish.
  if (Platform.OS === 'ios') await new Promise(resolve => setTimeout(resolve, 400));
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t.error, source === 'camera' ? t.cameraPermDenied : t.galleryPermDenied);
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1, base64: false, exif: false,
  };
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync(opts)
    : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  let b64: string | null | undefined;
  try {
    for (const st of [{ width: 900, compress: 0.4 }, { width: 720, compress: 0.35 }, { width: 600, compress: 0.3 }]) {
      const out = await ImageManipulator.manipulateAsync(
        res.assets[0].uri, [{ resize: { width: st.width } }],
        { compress: st.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      b64 = out.base64;
      if (b64 && b64.length <= 260_000) break;
    }
  } catch {
    Alert.alert(t.error, t.imageReadError);
    return null;
  }
  if (!b64) { Alert.alert(t.error, t.imageReadError); return null; }
  if (b64.length > 320_000) { Alert.alert(t.imageTooLargeTitle ?? '', t.imageTooLargeMsg ?? 'התמונה גדולה מדי'); return null; }
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * The photo row: thumbnails with a remove button, and an add tile up to the limit.
 *
 * `onChange` is the form's state setter, and every change goes through it as an
 * update of the CURRENT list: picking and compressing takes seconds, and a list
 * captured when ＋ was tapped would undo a ✕ made meanwhile, or bring back
 * photos the form cleared after sending. `onBusy` tells the form a photo is on
 * its way, so it can hold its send button until it lands.
 */
export function JobPhotosField({ photos, onChange, onBusy }: {
  photos: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  onBusy?: (busy: boolean) => void;
}) {
  const { t } = useLanguage();
  const C = useAppColors();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = React.useState(false);
  // "מצלמה או גלריה" in a sheet from the bottom, as on the website — not the
  // system's alert. Inside the form's own modal, so it opens over it.
  const [asking, setAsking] = React.useState(false);
  const add = () => {
    if (busy) return;
    if (photos.length >= JOB_PHOTOS_MAX) {
      Alert.alert('', (t as any).jobPhotosMax ?? 'אפשר לצרף עד 3 תמונות');
      return;
    }
    setAsking(true);
  };
  const choose = async (source: Source) => {
    setAsking(false);
    setBusy(true); onBusy?.(true);
    try {
      const uri = await pickJobPhoto(t, source);
      if (uri) onChange(prev => [...prev, uri].slice(0, JOB_PHOTOS_MAX));
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {photos.map((uri, i) => (
        <View key={i} style={{ position: 'relative' }}>
          <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" />
          <TouchableOpacity
            // This tile only. Filtering by value removed every copy of a photo
            // that had been added twice; by index alone, a list that changed
            // while a new photo was on its way could lose the wrong one.
            onPress={() => onChange(prev => {
              const at = prev[i] === uri ? i : prev.indexOf(uri);
              return at < 0 ? prev : prev.filter((_, j) => j !== at);
            })}
            style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel={(t as any).removePhoto ?? 'הסר תמונה'}
          >
            <T style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✕</T>
          </TouchableOpacity>
        </View>
      ))}
      {photos.length < JOB_PHOTOS_MAX && (
        <TouchableOpacity
          onPress={add}
          disabled={busy}
          style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderColor: C.blueBorder, borderStyle: 'dashed', backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel={(t as any).jobPhotoSourceTitle ?? 'הוספת תמונה'}
        >
          {busy ? <ActivityIndicator color={C.blue} /> : (
            <>
              <T style={{ fontSize: 26, color: C.blue }}>＋</T>
              <T style={{ fontSize: 20 }}>📷</T>
            </>
          )}
        </TouchableOpacity>
      )}
      <Modal visible={asking} transparent animationType="slide" onRequestClose={() => setAsking(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t.cancel ?? 'ביטול'} activeOpacity={1} style={{ flex: 1 }} onPress={() => setAsking(false)} />
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 18, paddingBottom: insets.bottom + 14, gap: 10 }}>
            <T style={{ fontSize: 16, fontWeight: '800', color: C.textDark, textAlign: 'center', marginBottom: 4 }}>{(t as any).jobPhotoSourceTitle ?? '📷 הוספת תמונה'}</T>
            <TouchableOpacity accessibilityRole="button" onPress={() => choose('camera')} style={{ minHeight: 50, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontSize: 16, fontWeight: '800', color: C.white }}>{(t as any).cameraOption ?? '📷 מצלמה'}</T>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => choose('library')} style={{ minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.blue, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontSize: 16, fontWeight: '800', color: C.blue }}>{(t as any).galleryOption ?? '🖼️ גלריה'}</T>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => setAsking(false)} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <T style={{ fontSize: 15, fontWeight: '700', color: C.textSub }}>{t.cancel ?? 'ביטול'}</T>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

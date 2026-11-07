import { Alert } from 'react-native';

/**
 * Asks before switching the app's language — "Change the language to English?"
 * — and switches only on yes (Ofek, 7.11.2026). A tap on the wrong flag used
 * to turn the whole app into a language its user may not read, with the way
 * back written in it. Same question on the website (SideDrawer, TopControls).
 */
export function confirmLangChange(t: any, name: string, onYes: () => void): void {
  Alert.alert(
    '',
    String(t.langChangeConfirm ?? 'לשנות את השפה ל-{lang}?').replace('{lang}', name),
    [
      { text: t.langChangeNo ?? 'לא', style: 'cancel' },
      { text: t.langChangeYes ?? 'כן', onPress: onYes },
    ],
  );
}

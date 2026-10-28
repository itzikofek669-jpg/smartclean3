import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from './LanguageContext';

/**
 * Back points the way the language came from: right in Hebrew and Arabic,
 * left in the five that read the other way. Ofek asked for the arrow to point
 * right, and in Hebrew that is also the direction "back" means — `arrow-back`
 * in a right-to-left layout reads as "forward".
 *
 * This mirrors the website's BACK_ARROW (src/components/BackButton.tsx), so
 * the two products cannot end up disagreeing about which way back is.
 */
export default function BackIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  const { isRTL } = useLanguage();
  return <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={size} color={color} />;
}

/** The same decision for the places that draw the arrow as text, not an icon. */
export const BACK_ARROW = (isRTL: boolean) => (isRTL ? '→' : '←');

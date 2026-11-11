/**
 * TextInput that follows the language. The app is drawn right to left and the
 * whole tree is mirrored for the left-to-right languages (LayoutDirection in
 * app/_layout.tsx) — under that mirror an input with no alignment of its own,
 * or one written `textAlign: 'right'` for Hebrew, stayed on the right in
 * English. In en/ru/fr/hi/uk those align left; Hebrew and Arabic unchanged.
 */
import React, { forwardRef } from 'react';
import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from 'react-native';
import { isRtlNow } from './trNow';

const DirTextInput = forwardRef<RNTextInput, TextInputProps>(function DirTextInput(props, ref) {
  if (isRtlNow()) return <RNTextInput ref={ref} {...props} />;
  const flat = (StyleSheet.flatten(props.style) ?? {}) as { textAlign?: string };
  const align = props.textAlign ?? flat.textAlign;
  const fixed = (align == null || align === 'right' ? 'left' : align) as TextInputProps['textAlign'];
  return <RNTextInput ref={ref} {...props} textAlign={fixed} style={[props.style, { textAlign: fixed }]} />;
});

export default DirTextInput;

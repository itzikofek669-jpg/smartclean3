import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { logError } from './logError';

/**
 * Catches render-time crashes and shows a recoverable screen.
 *
 * Without one, a React Native render error unmounts the whole tree: in a
 * release build the user gets a blank screen with no message and no way back —
 * their only option is to force-quit the app. For someone mid-booking that
 * reads as "the app is broken", not "something went wrong once".
 *
 * Deliberately a class component: `componentDidCatch` has no hook equivalent.
 *
 * Does NOT catch errors in event handlers, async code, or native modules —
 * those still need their own try/catch (see lib/logError).
 */
interface Props {
  children: ReactNode;
  context?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(`ErrorBoundary/${this.props.context ?? 'app'}`, {
      error,
      componentStack: info.componentStack,
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.wrap}>
        <Text style={s.emoji}>😕</Text>
        <Text style={s.title}>משהו השתבש</Text>
        <Text style={s.body}>
          נתקלנו בתקלה בהצגת המסך. אפשר לנסות שוב — הנתונים שלך לא נפגעו.
        </Text>

        {/* Re-rendering the subtree usually clears a transient failure without
            losing the session, so it's the primary action. */}
        <TouchableOpacity
          style={s.btn}
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="נסה שוב"
        >
          <Text style={s.btnText}>נסה שוב</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <ScrollView style={s.stackBox}>
            <Text style={s.stack}>{error.stack || error.message}</Text>
          </ScrollView>
        )}
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: '#fff' },
  emoji: { fontSize: 44 },
  title: { fontSize: 20, fontWeight: '800', color: '#111' },
  body: { fontSize: 14, color: '#666', textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  btn: { marginTop: 10, backgroundColor: '#0D4F96', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stackBox: { marginTop: 18, maxHeight: 200, alignSelf: 'stretch' },
  stack: { fontSize: 10, color: '#999', writingDirection: 'ltr' },
});

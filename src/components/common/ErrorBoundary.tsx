// src/components/common/ErrorBoundary.tsx
//
// Last line of defence for the JS thread.
//
// An uncaught error thrown while React is rendering or committing tears the
// whole tree down: React unmounts everything, the JS thread reports a
// `com.facebook.react.common.JavascriptException`, and the user sees the app
// die. There was nothing between a bad render and that outcome — one undefined
// field arriving from the API was enough to close the app.
//
// Two things happen here instead. The error is recorded with the component
// stack, which is the only part of a Hermes crash report that names an actual
// file; and the user is offered a way back rather than a dead process.

import React from 'react';
import {
  Appearance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { darkColors, lightColors } from '../../constants/colors';
import { logBreadcrumb, recordError } from '../../services/crashReporting';

interface Props {
  children: React.ReactNode;
  /** Label for the guarded region, used to group reports in Crashlytics. */
  context?: string;
}

interface State {
  error: Error | null;
  /** Bumped on reset so the subtree remounts from scratch. */
  resetKey: number;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The component stack is the useful half. A minified Hermes bundle reports
    // frames as `index.android.bundle:1:842317`, which names nothing; the
    // component stack still carries real component names.
    const componentStack = (info.componentStack ?? '').trim().slice(0, 2000);
    logBreadcrumb(`[ErrorBoundary] ${componentStack}`);
    recordError(error, this.props.context ?? 'errorBoundary', {
      message: error?.message ?? String(error),
    });
  }

  handleReset = () => {
    this.setState(s => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;
    if (!error) {
      return <React.Fragment key={resetKey}>{this.props.children}</React.Fragment>;
    }

    // Deliberately built from bare react-native primitives and raw tokens: the
    // component library, navigation and providers are all inside the subtree
    // that just failed, so the fallback must not depend on any of them.
    const colors = Appearance.getColorScheme() === 'dark' ? darkColors : lightColors;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Something went wrong
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          The app hit an unexpected error. Your data is safe — reloading usually
          clears it. The problem has been reported to us automatically.
        </Text>

        {__DEV__ && (
          <ScrollView style={styles.devBox}>
            <Text style={[styles.devText, { color: colors.destructive }]}>
              {error.message}
              {'\n\n'}
              {error.stack}
            </Text>
          </ScrollView>
        )}

        <Pressable
          onPress={this.handleReset}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: colors.primaryForeground }]}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  devBox: { maxHeight: 220, alignSelf: 'stretch', marginBottom: 24 },
  devText: { fontSize: 12, fontFamily: 'monospace' },
  button: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});

export default ErrorBoundary;

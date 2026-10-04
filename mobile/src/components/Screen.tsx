import type { ViewProps } from 'react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * Screen container: page background plus the bottom/side safe-area insets.
 *
 * The top inset is intentionally not applied here — the navigation header owns
 * it — which keeps tab content from being pushed down twice.
 */
export function Screen(props: ViewProps) {
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.screen} {...props} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});

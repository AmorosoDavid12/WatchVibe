import { View, Text, StyleSheet } from 'react-native';

export default function WatchlistScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Watchlist</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
});
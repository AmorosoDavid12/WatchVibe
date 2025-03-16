import { View, Text, StyleSheet } from 'react-native';

export default function WatchedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Watched</Text>
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
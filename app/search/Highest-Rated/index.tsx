import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Film, Tv, Play, BookOpen } from 'lucide-react-native';

export default function HighestRatedIndex() {
  const router = useRouter();

  const categories = [
    { id: 'movies', title: 'Movies', icon: <Film size={24} color="#fff" /> },
    { id: 'tv', title: 'TV Shows', icon: <Tv size={24} color="#fff" /> },
    { id: 'anime', title: 'Anime', icon: <Play size={24} color="#fff" /> },
    { id: 'documentaries', title: 'Documentaries', icon: <BookOpen size={24} color="#fff" /> },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Highest Rated Content</Text>
      <Text style={styles.pageSubtitle}>Select a category to view the best-rated content</Text>
      
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryItem}
            onPress={() => router.push(category.id as any)}
          >
            <View style={styles.categoryIcon}>{category.icon}</View>
            <Text style={styles.categoryTitle}>{category.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '48%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryIcon: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
}); 
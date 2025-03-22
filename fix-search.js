const fs = require('fs');
const filePath = 'app/(tabs)/search.tsx';

try {
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove problematic imports
  content = content.replace(/import { useColorScheme } from '@\/components\/useColorScheme';/g, '');
  content = content.replace(/import { SafeAreaView } from '@\/components\/SafeAreaView';/g, '');
  content = content.replace(/import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing, withSequence, withDelay } from 'react-native-reanimated';/g, '');
  
  // Replace SafeAreaView with View
  content = content.replace(/<SafeAreaView/g, '<View');
  content = content.replace(/<\/SafeAreaView>/g, '</View>');
  
  // Write the changes back to the file
  fs.writeFileSync(filePath, content);
  console.log("Successfully updated search.tsx!");
} catch (error) {
  console.error("Error processing file:", error);
} 
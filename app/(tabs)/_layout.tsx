import { Tabs } from 'expo-router';
import { Search, CircleCheck, CircleUser as UserCircle2, Bookmark } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
        },
        tabBarActiveTintColor: '#e21f70',
        tabBarInactiveTintColor: '#888',
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ size, color, focused }) => <Bookmark size={size} color={color} fill={focused ? color : 'transparent'} />,
          tabBarActiveTintColor: "rgb(255, 107, 107)",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ size, color }) => <Search size={size} color={color} />,
          tabBarActiveTintColor: "#2196F3",
        }}
      />
      <Tabs.Screen
        name="watched"
        options={{
          title: 'Watched',
          tabBarIcon: ({ size, color }) => <CircleCheck size={size} color={color} />,
          tabBarActiveTintColor: "rgb(140, 82, 255)",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <UserCircle2 size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
// App constants
import { Platform } from 'react-native';

// Define base URL for redirects - IMPORTANT: This must match your Supabase project's Site URL setting
export const APP_URL = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin 
  ? window.location.origin 
  : 'https://watch-vibe.vercel.app'; // Must match Supabase Site URL configuration

// Supabase project configuration
export const SUPABASE_PROJECT_ID = 'gihofdmqjwgkotwxdxms';
// Updated with the project's anon key
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaG9mZG1xandna290d3hkeG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNjc2ODUsImV4cCI6MjA1NzY0MzY4NX0.zYI7MLQutII3RGcORQsIq0jjPkOstQPb57Y0wXLSPiU';

// Supabase URL construction
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

// Debug output
console.log('APP_URL configured as:', APP_URL); 
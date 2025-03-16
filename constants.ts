// App constants
export const APP_URL = typeof window !== 'undefined' && window.location.origin 
  ? window.location.origin 
  : 'http://localhost:8081';

// Supabase project configuration
export const SUPABASE_PROJECT_ID = 'gihofdmqjwgkotwxdxms';
// Updated with the project's anon key
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaG9mZG1xandna290d3hkeG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNjc2ODUsImV4cCI6MjA1NzY0MzY4NX0.zYI7MLQutII3RGcORQsIq0jjPkOstQPb57Y0wXLSPiU';

// Try with different URL formats that might resolve better
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`; 
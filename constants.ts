// App constants
export const APP_URL = typeof window !== 'undefined' && window.location.origin 
  ? window.location.origin 
  : 'http://localhost:8081';

// Supabase project configuration
export const SUPABASE_PROJECT_ID = 'gihofdmqjwgkotwxdxms';
// TODO: Replace this with your project's anon key from:
// Project Settings > API > Project API keys > anon public
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucW53amR3d3FmZ2preG56cXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg5MzYzMDcsImV4cCI6MjAyNDUxMjMwN30.yTwkEX1bG6UPzlL2oJSOWF__PuMRQZQ8gRR7BzJLPc0';

// Try with different URL formats that might resolve better
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`; 
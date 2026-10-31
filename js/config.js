// Konfigurasi Supabase terpusat — cukup diubah di sini.
// (Key "anon" memang publik; keamanan data diatur lewat RLS di Supabase.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

export const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

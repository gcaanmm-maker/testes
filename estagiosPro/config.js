// config.js
const SUPABASE_URL = 'https://adyibndqyfiwvshsinbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeWlibmRxeWZpd3ZzaHNpbmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTAzMDAsImV4cCI6MjEwODI4NjMwMH0.WbD0pViuCiEevbwS1unh7PfNOu0ZO4SJIsaxBa8ke6E';

// Inicializa o cliente para ser acedido por toda a aplicação
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
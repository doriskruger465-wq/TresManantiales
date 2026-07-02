// Requiere que js/config.js se cargue ANTES que este archivo,
// y que la librería supabase-js esté cargada vía CDN en index.html.
const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

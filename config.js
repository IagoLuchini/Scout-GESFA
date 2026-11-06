/* =====================================================================
   CONFIGURAÇÃO DO SUPABASE — é o único lugar onde ficam as chaves.
   Troque as 2 linhas abaixo pelos dados do seu projeto.
   Use a chave "anon" / "publishable". NUNCA use a "service_role" / "secret".
   ===================================================================== */
const SUPABASE_URL = 'https://uzbejuuosmognxmtckpv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_N3u2FvaKvqXmr8c8sXVBwQ_hWSoCWz0';

// (não mexer daqui para baixo)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

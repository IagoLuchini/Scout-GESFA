/* =====================================================================
   CONFIGURAÇÃO DO SUPABASE — é o único lugar onde ficam as chaves.
   Troque as 2 linhas abaixo pelos dados do seu projeto.
   Use a chave "anon" / "publishable". NUNCA use a "service_role" / "secret".
   ===================================================================== */
const SUPABASE_URL = 'COLE_AQUI_A_URL_DO_PROJETO';
const SUPABASE_ANON_KEY = 'COLE_AQUI_A_CHAVE_ANON';

// (não mexer daqui para baixo)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

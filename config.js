/* =====================================================================
   CONFIGURAÇÃO DO SUPABASE — é o único lugar onde ficam as chaves.
   Troque as 2 linhas abaixo pelos dados do seu projeto.
   Use a chave "anon" / "publishable". NUNCA use a "service_role" / "secret".
   ===================================================================== */
const SUPABASE_URL = 'https://akrrnzvdinlurvagocwp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AWNpzk9mI3RbkcIJjTfb7Q_X6WlgjMz';

// (não mexer daqui para baixo)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

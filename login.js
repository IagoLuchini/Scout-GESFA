/* login.js — lógica da página de login (index.html) */

const PAGINA_DO_APP = 'painel.html';
const enderecoDestaPagina = () => location.href.split('#')[0].split('?')[0];
const irParaPainel = () => location.replace(PAGINA_DO_APP);

const forms = [...document.querySelectorAll('form')];
const mostrar = id => forms.forEach(f => { f.hidden = f.id !== id; });

function msg(form, texto, erro) {
  const p = form.querySelector('.msg');
  p.textContent = texto;
  p.className = 'msg ' + (erro ? 'erro' : 'muted');
}
const traduz = m => /Invalid login credentials/i.test(m) ? 'E-mail ou senha incorretos.'
  : /already registered/i.test(m) ? 'Este e-mail já está cadastrado.'
  : /Email not confirmed/i.test(m) ? 'Confirme seu e-mail antes de entrar (veja também o spam).'
  : /rate limit/i.test(m) ? 'Muitas tentativas. Aguarde um pouco e tente de novo.' : m;

document.querySelectorAll('[data-mostrar]').forEach(b =>
  b.addEventListener('click', () => mostrar(b.dataset.mostrar)));

// Chegou pelo link do e-mail "esqueci a senha"?
let recuperando = location.hash.includes('type=recovery');
if (recuperando) mostrar('form-nova-senha');

// Se já está logado, vai direto para o painel.
sb.auth.onAuthStateChange((evento, sessao) => {
  setTimeout(() => {
    if (evento === 'PASSWORD_RECOVERY') { recuperando = true; mostrar('form-nova-senha'); return; }
    if (sessao && !recuperando) irParaPainel();
  }, 0);
});

/* ENTRAR */
const formEntrar = document.getElementById('form-entrar');
formEntrar.addEventListener('submit', async e => {
  e.preventDefault();
  msg(formEntrar, '');
  const { error } = await sb.auth.signInWithPassword({
    email: formEntrar.elements.email.value.trim(),
    password: formEntrar.elements.senha.value,
  });
  if (error) msg(formEntrar, traduz(error.message), true);
  else irParaPainel();
});

/* ESQUECI A SENHA */
document.getElementById('btn-esqueci').addEventListener('click', async () => {
  const email = formEntrar.elements.email.value.trim();
  if (!email) { msg(formEntrar, 'Digite seu e-mail acima primeiro.', true); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: enderecoDestaPagina() });
  if (error) msg(formEntrar, traduz(error.message), true);
  else msg(formEntrar, 'Se o e-mail existir, enviamos um link para criar uma nova senha.');
});

/* CRIAR CONTA */
const formCadastro = document.getElementById('form-cadastro');
formCadastro.addEventListener('submit', async e => {
  e.preventDefault();
  msg(formCadastro, '');
  const { data, error } = await sb.auth.signUp({
    email: formCadastro.elements.email.value.trim(),
    password: formCadastro.elements.senha.value,
    options: { data: { nome: formCadastro.elements.nome.value.trim() }, emailRedirectTo: enderecoDestaPagina() },
  });
  if (error) { msg(formCadastro, traduz(error.message), true); return; }
  if (data.session) irParaPainel();
  else msg(formCadastro, 'Cadastro criado! Confirme seu e-mail (veja também o spam) e depois volte para entrar.');
});

/* NOVA SENHA */
const formNova = document.getElementById('form-nova-senha');
formNova.addEventListener('submit', async e => {
  e.preventDefault();
  const { error } = await sb.auth.updateUser({ password: formNova.elements.senha.value });
  if (error) { msg(formNova, traduz(error.message), true); return; }
  recuperando = false;
  irParaPainel();
});

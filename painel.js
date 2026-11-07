/* =====================================================================
   painel.js — busca os dados no Supabase e preenche o painel.html.
   O visual (textos, formulários, moldes) fica no painel.html.
   ===================================================================== */

const state = { user: null, perfil: null };

const RAMOS = { lobinho: 'Lobinho', escoteiro: 'Escoteiro', senior: 'Sênior', pioneiro: 'Pioneiro' };
const PAPEL = { pendente: 'Aguardando aprovação', chefe: 'Chefe', responsavel: 'Responsável', jovem: 'Jovem' };

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD (hora local)
const brl = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const dt = d => d ? d.split('-').reverse().join('/') : '—';

// Cria elementos sem innerHTML (textos digitados nunca viram código)
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'selected') el.selected = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const campoF = (el, k) => el.querySelector('[data-f="' + k + '"]');
function fill(el, obj) {
  for (const [k, v] of Object.entries(obj)) { const t = campoF(el, k); if (t) t.textContent = v ?? ''; }
}
function setOpcoes(select, lista, valor) {
  select.replaceChildren(...lista.map(([v, t]) => h('option', { value: v, selected: String(v) === String(valor ?? '') }, t)));
}
function toast(msg, erro) {
  const t = h('div', { class: 'toast' + (erro ? ' erro' : '') }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3800);
}
async function ok(promise) {
  const { data, error } = await promise;
  if (error) { error.avisado = true; toast(error.message, true); throw error; }
  return data;
}
const run = fn => async (...a) => {
  try { await fn(...a); }
  catch (e) { console.error(e); if (!e || !e.avisado) toast('Algo deu errado. Tente de novo.', true); }
};

/* ---------- partida ---------- */
async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.replace('index.html'); return; }
  state.user = session.user;

  sb.auth.onAuthStateChange(evento => { if (evento === 'SIGNED_OUT') location.replace('index.html'); });

  const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  $('#tela-carregando').hidden = true;
  if (error) { $('#tela-erro').hidden = false; console.error(error); return; }
  state.perfil = data;
  montarCasca();
}

function montarCasca() {
  const p = state.perfil;
  $('#topo').hidden = false;
  $('#quem-nome').textContent = p.nome || p.email;
  $('#quem-papel').textContent = PAPEL[p.papel] + (p.is_financeiro ? ' + Financeiro' : '');
  $('#btn-sair').onclick = () => sb.auth.signOut();

  if (p.papel === 'pendente') {
    $('#tela-pendente').hidden = false;
    $('#btn-verificar').onclick = () => location.reload();
    return;
  }

  // Mostra só o que o papel da pessoa pode ver (data-so="chefe", etc.)
  const tokens = [p.papel]; if (p.is_financeiro) tokens.push('financeiro');
  $$('[data-so]').forEach(el => { el.hidden = !el.dataset.so.split(' ').some(t => tokens.includes(t)); });
  if (!p.is_financeiro) $('#menu [data-tela="financeiro"]').textContent = 'Pagamentos';

  $('#menu').hidden = false;
  $$('#menu button').forEach(b => { b.onclick = () => ir(b.dataset.tela); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (b) ir(b.dataset.ir);
  });
  ir('avisos');
}

async function ir(tela, arg) {
  const base = ({ jovem: 'jovens', reuniao: 'presenca' })[tela] || tela;
  $$('#menu button').forEach(b => b.classList.toggle('on', b.dataset.tela === base));
  $$('main > section').forEach(s => { s.hidden = s.id !== 'tela-' + tela; });
  window.scrollTo(0, 0);
  try { await TELAS[tela](arg); }
  catch (e) { console.error(e); if (!e || !e.avisado) toast('Não foi possível carregar esta tela.', true); }
}

/* ---------- AVISOS ---------- */
async function tAvisos() {
  const avisos = await ok(sb.from('avisos').select('*').order('criado_em', { ascending: false }).limit(50));
  const lista = $('#lista-avisos');
  lista.replaceChildren();
  $('#avisos-vazio').hidden = avisos.length > 0;
  avisos.forEach(a => {
    const el = clone('tpl-aviso');
    fill(el, { titulo: a.titulo, texto: a.texto || '', data: new Date(a.criado_em).toLocaleDateString('pt-BR') });
    const del = campoF(el, 'excluir');
    if (state.perfil.papel === 'chefe') {
      del.onclick = run(async () => {
        if (!confirm('Excluir este aviso?')) return;
        await ok(sb.from('avisos').delete().eq('id', a.id));
        ir('avisos');
      });
    } else del.remove();
    lista.append(el);
  });
  $('#form-aviso').onsubmit = run(async e => {
    e.preventDefault();
    const f = e.target.elements;
    await ok(sb.from('avisos').insert({ titulo: f.titulo.value.trim(), texto: f.texto.value.trim() }));
    e.target.reset(); toast('Aviso publicado'); ir('avisos');
  });
}

/* ---------- JOVENS (chefe) ---------- */
async function tJovens() {
  const jovens = await ok(sb.from('jovens').select('*').order('nome'));
  const busca = $('#busca-jovem'), lista = $('#lista-jovens');
  $('#jovens-total').textContent = jovens.length + ' jovem(ns) cadastrado(s)';
  function desenha() {
    const f = busca.value.toLowerCase();
    const itens = jovens.filter(j => j.nome.toLowerCase().includes(f));
    lista.replaceChildren();
    $('#jovens-vazio').hidden = itens.length > 0;
    itens.forEach(j => {
      const el = clone('tpl-jovem-item');
      fill(el, { nome: j.nome, ramo: (RAMOS[j.ramo] || 'sem ramo') + (j.ativo ? '' : ' · inativo') });
      el.onclick = () => ir('jovem', j.id);
      lista.append(el);
    });
  }
  busca.oninput = desenha;
  desenha();
  $('#form-jovem-novo').onsubmit = run(async e => {
    e.preventDefault();
    const f = e.target.elements;
    const j = await ok(sb.from('jovens').insert({
      nome: f.nome.value.trim(), nascimento: f.nascimento.value || null, ramo: f.ramo.value || null,
    }).select().single());
    e.target.reset(); toast('Jovem cadastrado'); ir('jovem', j.id);
  });
}

function fichaForm(jovemId, ficha) {
  const form = clone('tpl-ficha');
  ficha = ficha || {};
  const campos = $$('[name]', form);
  campos.forEach(c => { c.value = ficha[c.name] || ''; });
  form.onsubmit = run(async e => {
    e.preventDefault();
    const row = { jovem_id: jovemId, atualizado_em: new Date().toISOString() };
    campos.forEach(c => { row[c.name] = c.value.trim() || null; });
    await ok(sb.from('fichas_medicas').upsert(row));
    toast('Ficha salva');
  });
  return form;
}

async function tJovem(id) {
  const [j, vincs, profs, ficha, pres] = await Promise.all([
    ok(sb.from('jovens').select('*').eq('id', id).single()),
    ok(sb.from('vinculos').select('id,jovem_acesso,consentimento_em,responsavel_id,profiles(nome,email)').eq('jovem_id', id)),
    ok(sb.from('profiles').select('id,nome,email,papel').in('papel', ['responsavel', 'jovem']).order('nome')),
    ok(sb.from('fichas_medicas').select('*').eq('jovem_id', id).maybeSingle()),
    ok(sb.from('presencas').select('presente').eq('jovem_id', id)),
  ]);
  $('#jovem-nome').textContent = j.nome;

  // dados
  const form = $('#form-jovem-dados'), E = form.elements;
  E.nome.value = j.nome; E.nascimento.value = j.nascimento || ''; E.ramo.value = j.ramo || ''; E.ativo.checked = j.ativo;
  setOpcoes(E.user_id, [['', 'Nenhum'], ...profs.filter(p => p.papel === 'jovem').map(p => [p.id, (p.nome || '') + ' (' + p.email + ')'])], j.user_id || '');
  form.onsubmit = run(async e => {
    e.preventDefault();
    await ok(sb.from('jovens').update({
      nome: E.nome.value.trim(), nascimento: E.nascimento.value || null, ramo: E.ramo.value || null,
      ativo: E.ativo.checked, user_id: E.user_id.value || null,
    }).eq('id', id));
    toast('Dados salvos'); ir('jovem', id);
  });

  // responsáveis
  const lv = $('#lista-vinculos');
  lv.replaceChildren();
  $('#vinculos-vazio').hidden = vincs.length > 0;
  vincs.forEach(v => {
    const el = clone('tpl-vinculo');
    fill(el, {
      nome: v.profiles?.nome || v.profiles?.email || '—',
      info: 'Consentimento: ' + (v.consentimento_em ? 'registrado' : 'pendente') + ' · Acesso do jovem: ' + (v.jovem_acesso ? 'liberado' : 'não liberado'),
    });
    campoF(el, 'remover').onclick = run(async () => {
      if (!confirm('Remover este vínculo?')) return;
      await ok(sb.from('vinculos').delete().eq('id', v.id)); ir('jovem', id);
    });
    lv.append(el);
  });
  const ja = new Set(vincs.map(v => v.responsavel_id));
  setOpcoes($('#vinc-resp'), [['', 'Escolher responsável…'],
    ...profs.filter(p => p.papel === 'responsavel' && !ja.has(p.id)).map(p => [p.id, (p.nome || '') + ' (' + p.email + ')'])], '');
  $('#btn-vincular').onclick = run(async () => {
    const r = $('#vinc-resp').value;
    if (!r) return;
    await ok(sb.from('vinculos').insert({ responsavel_id: r, jovem_id: id })); ir('jovem', id);
  });

  // ficha médica e presença
  $('#ficha-jovem').replaceChildren(fichaForm(id, ficha));
  const pr = pres.filter(p => p.presente).length;
  $('#jovem-presenca').textContent = pres.length
    ? `Presente em ${pr} de ${pres.length} reuniões (${Math.round(100 * pr / pres.length)}%).` : 'Sem registros de presença ainda.';

  $('#btn-excluir-jovem').onclick = run(async () => {
    if (!confirm('Excluir este jovem e TODOS os dados dele (pagamentos, presenças, ficha)? Não dá para desfazer.')) return;
    await ok(sb.from('jovens').delete().eq('id', id)); toast('Jovem excluído'); ir('jovens');
  });
}

/* ---------- PRESENÇA (chefe) ---------- */
async function tPresenca() {
  const rs = await ok(sb.from('reunioes').select('*').order('data', { ascending: false }).limit(60));
  const lista = $('#lista-reunioes');
  lista.replaceChildren();
  rs.forEach(r => {
    const el = clone('tpl-reuniao-item');
    fill(el, { data: dt(r.data), titulo: r.titulo, ramo: r.ramo ? RAMOS[r.ramo] : 'Todos' });
    el.onclick = () => ir('reuniao', r.id);
    lista.append(el);
  });
  const form = $('#form-reuniao-nova');
  if (!form.elements.data.value) form.elements.data.value = hoje();
  form.onsubmit = run(async e => {
    e.preventDefault();
    const f = form.elements;
    const r = await ok(sb.from('reunioes').insert({ data: f.data.value, titulo: f.titulo.value.trim(), ramo: f.ramo.value || null }).select().single());
    form.reset(); ir('reuniao', r.id);
  });
}

async function tReuniao(id) {
  const r = await ok(sb.from('reunioes').select('*').eq('id', id).single());
  let q = sb.from('jovens').select('id,nome').eq('ativo', true).order('nome');
  if (r.ramo) q = q.eq('ramo', r.ramo);
  const [jovens, pres] = await Promise.all([ok(q), ok(sb.from('presencas').select('*').eq('reuniao_id', id))]);
  const mapa = new Map(pres.map(p => [p.jovem_id, p.presente]));

  $('#reuniao-titulo').textContent = r.titulo;
  $('#reuniao-info').textContent = dt(r.data) + (r.ramo ? ' · ' + RAMOS[r.ramo] : '');
  const cks = jovens.map(j => ({ j, el: h('input', { type: 'checkbox', checked: mapa.get(j.id) === true }) }));
  $('#chamada').replaceChildren(...cks.map(c => h('label', { class: 'chk' }, c.el, c.j.nome)));
  $('#chamada-vazia').hidden = jovens.length > 0;

  $('#btn-marcar-todos').onclick = () => cks.forEach(c => { c.el.checked = true; });
  $('#btn-desmarcar-todos').onclick = () => cks.forEach(c => { c.el.checked = false; });
  $('#btn-salvar-chamada').onclick = run(async () => {
    if (!cks.length) return;
    await ok(sb.from('presencas').upsert(
      cks.map(c => ({ reuniao_id: id, jovem_id: c.j.id, presente: c.el.checked })), { onConflict: 'reuniao_id,jovem_id' }));
    toast('Chamada salva: ' + cks.filter(c => c.el.checked).length + ' presente(s)');
  });
  $('#btn-excluir-reuniao').onclick = run(async () => {
    if (!confirm('Excluir esta reunião e a chamada dela?')) return;
    await ok(sb.from('reunioes').delete().eq('id', id)); ir('presenca');
  });
}

/* ---------- USUÁRIOS (chefe) ---------- */
async function tUsuarios() {
  const profs = await ok(sb.from('profiles').select('*').order('criado_em', { ascending: false }));
  profs.sort((a, b) => (b.papel === 'pendente') - (a.papel === 'pendente')); // pendentes primeiro
  const lista = $('#lista-usuarios');
  lista.replaceChildren();
  profs.forEach(p => {
    const el = clone('tpl-usuario');
    fill(el, { nome: p.nome || '(sem nome)', email: p.email });
    const papel = campoF(el, 'papel'), fin = campoF(el, 'financeiro');
    papel.value = p.papel; fin.checked = p.is_financeiro;
    campoF(el, 'salvar').onclick = run(async () => {
      if (p.id === state.user.id && papel.value !== 'chefe' && !confirm('Você está tirando seu próprio papel de chefe. Continuar?')) return;
      await ok(sb.from('profiles').update({ papel: papel.value, is_financeiro: fin.checked }).eq('id', p.id));
      toast('Usuário atualizado'); ir('usuarios');
    });
    lista.append(el);
  });
}

/* ---------- RESPONSÁVEL: meus filhos ---------- */
async function tFilhos() {
  const vincs = await ok(sb.from('vinculos').select('jovem_id,jovem_acesso,consentimento_em,jovens(id,nome,nascimento,ramo)').eq('responsavel_id', state.user.id));
  const lista = $('#lista-filhos');
  lista.replaceChildren();
  $('#filhos-vazio').hidden = vincs.length > 0;
  if (!vincs.length) return;
  const fichas = await ok(sb.from('fichas_medicas').select('*').in('jovem_id', vincs.map(v => v.jovem_id)));
  vincs.forEach(v => {
    const j = v.jovens || {};
    const el = clone('tpl-filho');
    fill(el, { nome: j.nome || 'Jovem', info: (RAMOS[j.ramo] || 'Sem ramo') + ' · Nascimento: ' + dt(j.nascimento) });

    const okTxt = campoF(el, 'consent-ok'), pend = campoF(el, 'consent-pendente');
    if (v.consentimento_em) {
      okTxt.textContent = '✅ Consentimento de uso dos dados registrado em ' + new Date(v.consentimento_em).toLocaleDateString('pt-BR');
      okTxt.hidden = false;
    } else {
      pend.hidden = false;
      campoF(el, 'btn-consent').onclick = run(async () => {
        await ok(sb.rpc('registrar_consentimento', { p_jovem: v.jovem_id }));
        toast('Consentimento registrado'); ir('filhos');
      });
    }

    const acesso = campoF(el, 'acesso');
    acesso.checked = v.jovem_acesso;
    acesso.onchange = run(async () => {
      await ok(sb.rpc('definir_acesso_jovem', { p_jovem: v.jovem_id, p_ativo: acesso.checked }));
      toast(acesso.checked ? 'Acesso do jovem liberado' : 'Acesso do jovem removido');
    });

    campoF(el, 'ficha').append(fichaForm(v.jovem_id, fichas.find(f => f.jovem_id === v.jovem_id)));
    lista.append(el);
  });
}

/* ---------- JOVEM: meu perfil ---------- */
async function tMeuPerfil() {
  const js = await ok(sb.from('jovens').select('*'));
  $('#meuperfil-bloqueado').hidden = js.length > 0;
  $('#meuperfil-dados').hidden = js.length === 0;
  if (!js.length) return;
  const j = js[0];
  const pres = await ok(sb.from('presencas').select('presente').eq('jovem_id', j.id));
  const pr = pres.filter(p => p.presente).length;
  $('#mp-nome').textContent = j.nome;
  $('#mp-ramo').textContent = RAMOS[j.ramo] || '—';
  $('#mp-nasc').textContent = dt(j.nascimento);
  $('#mp-presenca').textContent = pres.length
    ? `Presença: ${pr} de ${pres.length} reuniões (${Math.round(100 * pr / pres.length)}%)` : 'Presença: sem registros ainda.';
}

/* ---------- PRESENÇAS (jovem / responsável) ---------- */
async function tPresencas() {
  const rows = await ok(sb.from('presencas').select('presente,jovens(nome),reunioes(data,titulo)'));
  const lista = $('#lista-presencas');
  lista.replaceChildren();
  $('#presencas-vazio').hidden = rows.length > 0;
  rows.sort((a, b) => (b.reunioes?.data || '').localeCompare(a.reunioes?.data || ''));
  const grupos = new Map();
  rows.forEach(r => { const n = r.jovens?.nome || '—'; if (!grupos.has(n)) grupos.set(n, []); grupos.get(n).push(r); });
  grupos.forEach((rs, nome) => {
    const pr = rs.filter(r => r.presente).length;
    lista.append(h('div', { class: 'card' },
      h('h3', {}, nome),
      h('p', { class: 'muted' }, `${pr} de ${rs.length} (${Math.round(100 * pr / rs.length)}%)`),
      ...rs.slice(0, 30).map(r => h('div', { class: 'row' },
        h('span', {}, dt(r.reunioes?.data) + ' · ' + (r.reunioes?.titulo || '')),
        h('span', {}, r.presente ? '✅ Presente' : '❌ Faltou')))));
  });
}

/* ---------- FINANCEIRO ---------- */
async function tFinanceiro() {
  const manage = !!state.perfil.is_financeiro;
  const pags = await ok(sb.from('pagamentos').select('*,jovens(nome)').order('vencimento', { ascending: false }));
  const jovens = manage ? await ok(sb.from('jovens').select('id,nome,ativo').order('nome')) : [];
  const status = p => p.pago_em ? 'pago' : (p.vencimento < hoje() ? 'atrasado' : 'aberto');
  const ROT = { pago: 'Pago', atrasado: 'Atrasado', aberto: 'Em aberto' };
  const soma = f => pags.filter(f).reduce((s, p) => s + Number(p.valor), 0);

  $('#kpi-recebido').textContent = brl(soma(p => status(p) === 'pago'));
  $('#kpi-aberto').textContent = brl(soma(p => status(p) === 'aberto'));
  $('#kpi-atrasado').textContent = brl(soma(p => status(p) === 'atrasado'));
  $('#fin-leitura').hidden = manage;

  // filtros
  const fSt = $('#fin-status'), fNome = $('#fin-nome');
  const nomeAntes = fNome.value;
  const nomes = [...new Set(pags.map(p => p.jovens?.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  setOpcoes(fNome, [['', 'Todos os jovens'], ...nomes.map(n => [n, n])], nomeAntes);

  function desenha() {
    const lista = pags.filter(p => (!fSt.value || status(p) === fSt.value) && (!fNome.value || p.jovens?.nome === fNome.value));
    $('#fin-vazio').hidden = lista.length > 0;
    $('#fin-corpo').replaceChildren(...lista.map(p => h('tr', {},
      h('td', {}, p.jovens?.nome || '—'),
      h('td', {}, p.descricao),
      h('td', {}, dt(p.vencimento)),
      h('td', {}, brl(p.valor)),
      h('td', {}, h('span', { class: 'st ' + status(p) }, ROT[status(p)] + (p.pago_em ? ' em ' + dt(p.pago_em) : ''))),
      manage ? h('td', {},
        h('button', { class: 'link', onclick: run(async () => {
          await ok(sb.from('pagamentos').update({ pago_em: p.pago_em ? null : hoje() }).eq('id', p.id)); ir('financeiro');
        }) }, p.pago_em ? 'Desfazer' : 'Marcar pago'),
        h('button', { class: 'link perigo', onclick: run(async () => {
          if (!confirm('Excluir este lançamento?')) return;
          await ok(sb.from('pagamentos').delete().eq('id', p.id)); ir('financeiro');
        }) }, 'Excluir')) : null)));
  }
  fSt.onchange = desenha; fNome.onchange = desenha;
  desenha();

  if (!manage) return;

  // novo lançamento
  const form = $('#form-lanc'), E = form.elements;
  setOpcoes(E.jovem, [['', 'Escolher jovem…'], ['todos', '★ Todos os jovens ativos'],
    ...jovens.map(j => [j.id, j.nome + (j.ativo ? '' : ' (inativo)')])], '');
  form.onsubmit = run(async e => {
    e.preventDefault();
    if (!E.jovem.value) { toast('Escolha o jovem', true); return; }
    const alvo = E.jovem.value === 'todos' ? jovens.filter(j => j.ativo) : [{ id: E.jovem.value }];
    if (!alvo.length) { toast('Nenhum jovem ativo', true); return; }
    await ok(sb.from('pagamentos').insert(alvo.map(j => ({
      jovem_id: j.id, descricao: E.descricao.value.trim(), valor: parseFloat(E.valor.value), vencimento: E.vencimento.value,
    }))));
    form.reset(); toast(alvo.length + ' lançamento(s) criado(s)'); ir('financeiro');
  });


// EXPORTAÇÃO DE DADOS FINANCEIROS PARA CSV

$('#btn-csv').onclick = () => {

  // Verifica se existem pagamentos
  if (!pags || pags.length === 0) {
    alert('Não existem pagamentos para exportar.');
    return;
  }

  // Cabeçalho da planilha
  const linhas = [
    ['Jovem', 'Descrição', 'Vencimento', 'Valor', 'Status', 'Pago em'],

    ...pags.map(p => [
      p.jovens?.nome || 'Não informado',
      p.descricao || 'Sem descrição',
      p.vencimento || '',
      Number(p.valor || 0).toFixed(2).replace('.', ','),
      ROT[status(p)] || 'Não informado',
      p.pago_em || ''
    ])
  ];

  // Escapa os dados para evitar erros no CSV
  const formatarCSV = valor =>
    '"' + String(valor ?? '').replace(/"/g, '""') + '"';

  // Converte os dados em texto CSV
  const csv = '\uFEFF' + linhas
    .map(linha => linha.map(formatarCSV).join(';'))
    .join('\r\n');

  // Cria o arquivo
  const arquivo = new Blob(
    [csv],
    { type: 'text/csv;charset=utf-8;' }
  );

  // Cria o link temporário para download
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');

  link.href = url;
  link.download = `financeiro-${hoje()}.csv`;

  // Realiza o download
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Libera a memória utilizada
  setTimeout(() => URL.revokeObjectURL(url), 1000);

};


const TELAS = {
  avisos: tAvisos, jovens: tJovens, jovem: tJovem, presenca: tPresenca, reuniao: tReuniao, usuarios: tUsuarios,
  filhos: tFilhos, meuperfil: tMeuPerfil, presencas: tPresencas, financeiro: tFinanceiro,
};

iniciar();


// ======================================
// 1. CAMPOS CONDICIONAIS
// ======================================

function configurarCampo(selectName, divId, textareaName) {

  const select = document.querySelector(`[name="${selectName}"]`);
  const div = document.getElementById(divId);
  const textarea = document.querySelector(`[name="${textareaName}"]`);

  function atualizar() {

    const ativo = select.value === "sim";

    div.hidden = !ativo;
    textarea.required = ativo;
    textarea.disabled = !ativo;

  }

  select.addEventListener("change", atualizar);

  atualizar();
}

// Configurando os três campos

configurarCampo("alergia", "campo-alergias", "alergias");

configurarCampo("usa_medicamento", "campo-medicamentos", "medicamentos");

configurarCampo("tem_restricao", "campo-alimentacao", "alimentacao");


// ======================================
// 2. MÁSCARA DE CPF
// ======================================

function mascaraCPF(valor) {

  return valor
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

}

document.querySelectorAll('[name="cpf"], [name="cpf1"], [name="cpf2"]')
.forEach(campo => {

  campo.addEventListener("input", () => {
    campo.value = mascaraCPF(campo.value);
  });

});


// ======================================
// 3. MÁSCARA DE CEP
// ======================================

const campoCEP = document.querySelector('[name="cep"]');

campoCEP.addEventListener("input", () => {

  let valor = campoCEP.value.replace(/\D/g, "").slice(0, 8);

  if (valor.length > 5) {
    valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
  }

  campoCEP.value = valor;

});


// ======================================
// 4. MÁSCARA DE TELEFONE
// ======================================

document.querySelectorAll(
  '[name="telefone"], [name="tel1"], [name="tel2"], [name="tel_emergencia"], [name="tel_emergencia2"]'
).forEach(campo => {

  campo.addEventListener("input", () => {

    let valor = campo.value.replace(/\D/g, "").slice(0, 11);

    if (valor.length > 10) {
      valor = valor.replace(
        /^(\d{2})(\d{5})(\d{4})$/,
        "($1) $2-$3"
      );
    } else if (valor.length > 6) {
      valor = valor.replace(
        /^(\d{2})(\d{4})(\d{1,4})$/,
        "($1) $2-$3"
      );
    } else if (valor.length > 2) {
      valor = valor.replace(/^(\d{2})(\d+)/, "($1) $2");
    }

    campo.value = valor;

  });

});


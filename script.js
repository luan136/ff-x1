
const db = supabaseClient;

let usuarioAtual = null;
let modoSelecionado = "X1";

const conteudo = document.getElementById("conteudo");

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, letra => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[letra]);
}

function aviso(mensagem) {
  alert(mensagem);
}

async function iniciarApp() {
  if (!db) {
    aviso("Não foi possível carregar o Supabase. Confira os arquivos.");
    return;
  }

  const { data, error } = await db.auth.getSession();

  if (error) {
    aviso(error.message);
    return;
  }

  usuarioAtual = data.session?.user || null;

  if (usuarioAtual) {
    await carregarInicio();
  } else {
    mostrarLogin();
  }

  db.auth.onAuthStateChange((_evento, session) => {
    usuarioAtual = session?.user || null;
  });
}

function mostrarLogin() {
  conteudo.innerHTML = `
    <div class="panel">
      <h2>ENTRAR NO FF X1</h2>

      <label>E-mail</label>
      <input id="email" type="email" placeholder="Seu e-mail">

      <label>Senha</label>
      <input id="senha" type="password" placeholder="Sua senha">

      <button class="acao" onclick="entrar()">ENTRAR</button>

      <button class="acao" onclick="mostrarCadastro()">
        CRIAR CONTA
      </button>
    </div>
  `;
}

function mostrarCadastro() {
  conteudo.innerHTML = `
    <div class="panel">
      <h2>CRIAR CONTA</h2>

      <label>Nick do Free Fire</label>
      <input id="nickname" placeholder="Seu nick">

      <label>ID do Free Fire</label>
      <input id="ffid" placeholder="Seu ID no jogo">

      <label>E-mail</label>
      <input id="email" type="email" placeholder="Seu e-mail">

      <label>Senha</label>
      <input id="senha" type="password" placeholder="Mínimo de 6 caracteres">

      <button class="acao" onclick="cadastrar()">CADASTRAR</button>
      <button class="acao" onclick="mostrarLogin()">VOLTAR</button>
    </div>
  `;
}

async function entrar() {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  if (!email || !senha) return aviso("Preencha e-mail e senha.");

  const { error } = await db.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) return aviso(error.message);

  usuarioAtual = (await db.auth.getUser()).data.user;
  await carregarInicio();
}

async function cadastrar() {
  const nickname = document.getElementById("nickname").value.trim();
  const ffid = document.getElementById("ffid").value.trim();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  if (!nickname || !ffid || !email || !senha) {
    return aviso("Preencha todos os campos.");
  }

  if (senha.length < 6) {
    return aviso("A senha precisa ter pelo menos 6 caracteres.");
  }

  const { data, error } = await db.auth.signUp({
    email,
    password: senha
  });

  if (error) return aviso(error.message);

  if (!data.user) {
    return aviso("Confira seu e-mail para confirmar o cadastro.");
  }

  const { error: perfilErro } = await db
    .from("jogadores")
    .insert({
      id: data.user.id,
      nickname,
      aprovado: false
    });

  if (perfilErro) {
    return aviso(
      "Conta criada, mas o perfil não foi salvo: " + perfilErro.message
    );
  }

  aviso("Cadastro realizado! Aguarde a aprovação da administração.");

  if (data.session) {
    await db.auth.signOut();
  }

  mostrarLogin();
}

async function sair() {
  const { error } = await db.auth.signOut();

  if (error) return aviso(error.message);

  usuarioAtual = null;
  mostrarLogin();
}

async function carregarInicio() {
  if (!usuarioAtual) return mostrarLogin();

  const { data: jogador, error } = await db
    .from("jogadores")
    .select("nickname, aprovado")
    .eq("id", usuarioAtual.id)
    .maybeSingle();

  if (error) return aviso(error.message);

  if (!jogador || !jogador.aprovado) {
    conteudo.innerHTML = `
      <div class="panel">
        <h2>CADASTRO EM ANÁLISE</h2>
        <p>Seu acesso está aguardando aprovação da administração.</p>
        <button class="acao" onclick="sair()">SAIR</button>
      </div>
    `;
    return;
  }

  await atualizarEstatisticas();

  conteudo.innerHTML = `
    <div class="panel">
      <h2>SEJA BEM-VINDO AO FF X1!</h2>
      <p>Jogador: ${escapar(jogador.nickname)}</p>
      <p>Escolha seu modo de confronto.</p>
      <button class="acao" onclick="listarConfrontos()">VER CONFRONTOS</button>
      <button class="acao" onclick="listarJogadores()">JOGADORES</button>
      <button class="acao" onclick="sair()">SAIR DA CONTA</button>
    </div>
  `;
}

async function atualizarEstatisticas() {
  const { count: jogadores } = await db
    .from("jogadores")
    .select("*", { count: "exact", head: true })
    .eq("aprovado", true);

  const { count: confrontos } = await db
    .from("confrontos")
    .select("*", { count: "exact", head: true });

  const { count: vitorias } = await db
    .from("confrontos")
    .select("*", { count: "exact", head: true })
    .eq("vencedor_id", usuarioAtual.id);

  document.getElementById("jogadores").textContent = jogadores ?? 0;
  document.getElementById("confrontos").textContent = confrontos ?? 0;
  document.getElementById("vitorias").textContent = vitorias ?? 0;
}

async function selecionarModo(modo) {
  if (!usuarioAtual) return mostrarLogin();

  modoSelecionado = modo;

  const { data: jogador } = await db
    .from("jogadores")
    .select("aprovado")
    .eq("id", usuarioAtual.id)
    .maybeSingle();

  if (!jogador?.aprovado) {
    return aviso("Seu cadastro ainda não foi aprovado.");
  }

  const { data: jogadores, error } = await db
    .from("jogadores")
    .select("id, nickname")
    .eq("aprovado", true)
    .neq("id", usuarioAtual.id)
    .order("nickname");

  if (error) return aviso(error.message);

  conteudo.innerHTML = `
    <div class="panel">
      <h2>CRIAR ${escapar(modo)}</h2>

      <label>Escolha seu adversário</label>

      <select id="adversario">
        <option value="">Selecione um jogador</option>
        ${(jogadores || []).map(j => `
          <option value="${escapar(j.id)}">
            ${escapar(j.nickname)}
          </option>
        `).join("")}
      </select>

      <label>Data e horário</label>
      <input id="dataConfronto" type="datetime-local">

      <button class="acao" onclick="criarDesafio()">
        ENVIAR DESAFIO
      </button>

      <button class="acao" onclick="carregarInicio()">VOLTAR</button>
    </div>
  `;
}

async function criarDesafio() {
  const adversario = document.getElementById("adversario").value;
  const data = document.getElementById("dataConfronto").value;

  if (!adversario || !data) {
    return aviso("Escolha o adversário e a data.");
  }

  const dataEscolhida = new Date(data);

  if (Number.isNaN(dataEscolhida.getTime()) ||
      dataEscolhida <= new Date()) {
    return aviso("Escolha uma data futura válida.");
  }

  const { error } = await db
    .from("confrontos")
    .insert({
      criador_id: usuarioAtual.id,
      adversario_id: adversario,
      formato: modoSelecionado,
      status: "pendente",
      data_confronto: dataEscolhida.toISOString()
    });

  if (error) return aviso("Não foi possível criar: " + error.message);

  aviso("Desafio enviado!");
  await listarConfrontos();
  await atualizarEstatisticas();
}

async function listarJogadores() {
  const { data, error } = await db
    .from("jogadores")
    .select("nickname")
    .eq("aprovado", true)
    .order("nickname");

  if (error) return aviso(error.message);

  conteudo.innerHTML = `
    <h2>JOGADORES APROVADOS</h2>
    ${(data || []).map(j => `
      <div class="item">
        <h3>${escapar(j.nickname)}</h3>
      </div>
    `).join("") || '<p class="vazio">Nenhum jogador encontrado.</p>'}

    <button class="acao" onclick="carregarInicio()">VOLTAR</button>
  `;
}

async function listarConfrontos() {
  const { data, error } = await db
    .from("confrontos")
    .select("id, formato, status, data_confronto, criador_id, adversario_id")
    .order("criado_em", { ascending: false });

  if (error) return aviso(error.message);

  conteudo.innerHTML = `
    <h2>CONFRONTOS</h2>

    ${(data || []).map(c => `
      <div class="item">
        <h3>${escapar(c.formato)}</h3>
        <p>Status: ${escapar(c.status)}</p>
        <p>Data: ${new Date(c.data_confronto).toLocaleString("pt-BR")}</p>
      </div>
    `).join("") || '<p class="vazio">Nenhum confronto encontrado.</p>'}

    <button class="acao" onclick="carregarInicio()">VOLTAR</button>
  `;
}

async function mostrarDesafios() {
  await selecionarModo("X1");
}

document.addEventListener("DOMContentLoaded", iniciarApp);

// Servidor HTTP estático minimalista, sem dependências externas.
// Uso: node servidor-estatico.js [porta]
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dns = require("dns").promises;

const pastaProjeto = path.resolve(__dirname);
const porta = Number(process.argv[2] || 5500);
const arquivoUsuarios = path.join(pastaProjeto, "dados", "usuarios.json");

const tiposMime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function caminhoDoArquivo(url) {
  const caminhoUrl = decodeURIComponent(url.split("?")[0]);
  const caminhoRelativo = caminhoUrl === "/" ? "/index.html" : caminhoUrl;
  const caminhoArquivo = path.resolve(pastaProjeto, `.${caminhoRelativo}`);

  if (
    caminhoArquivo !== pastaProjeto &&
    !caminhoArquivo.startsWith(`${pastaProjeto}${path.sep}`)
  ) {
    return null;
  }

  return caminhoArquivo;
}

function responderJson(res, status, dados) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(dados));
}

function lerUsuarios() {
  try {
    return JSON.parse(fs.readFileSync(arquivoUsuarios, "utf8"));
  } catch {
    return [];
  }
}

function salvarUsuarios(usuarios) {
  fs.writeFileSync(arquivoUsuarios, `${JSON.stringify(usuarios, null, 2)}\n`);
}

function criarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function conferirSenha(senha, senhaArmazenada) {
  const [salt, hashSalvo] = senhaArmazenada.split(":");
  const hashRecebido = crypto.scryptSync(senha, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hashSalvo, "hex"),
    Buffer.from(hashRecebido, "hex"),
  );
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    foto: usuario.foto || "",
  };
}

function emailTemFormatoValido(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function dominioPodeReceberEmail(email) {
  const dominio = email.split("@")[1];
  try {
    const registrosMx = await dns.resolveMx(dominio);
    return registrosMx.length > 0;
  } catch (erro) {
    // Se o DNS estiver indisponível, a validação de formato continua valendo.
    return !["ENOTFOUND", "ENODATA", "NODATA"].includes(erro.code);
  }
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    req.on("data", (parte) => {
      corpo += parte;
      if (corpo.length > 10000) {
        reject(new Error("Corpo muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(corpo || "{}"));
      } catch (erro) {
        reject(erro);
      }
    });
    req.on("error", reject);
  });
}

async function tratarApi(req, res) {
  try {
    const dados = await lerCorpo(req);
    const usuarios = lerUsuarios();
    const email = String(dados.email || "").trim().toLowerCase();
    const senha = String(dados.senha || "");

    if (!email || !senha) {
      responderJson(res, 400, { erro: "E-mail e senha são obrigatórios." });
      return;
    }

    if (!emailTemFormatoValido(email)) {
      responderJson(res, 400, { erro: "Digite um e-mail válido." });
      return;
    }

    if (req.url === "/api/cadastro") {
      const nome = String(dados.nome || "").trim();
      if (!nome) {
        responderJson(res, 400, { erro: "O nome é obrigatório." });
        return;
      }
      if (senha.length < 6) {
        responderJson(res, 400, { erro: "A senha deve ter pelo menos 6 caracteres." });
        return;
      }
      if (!(await dominioPodeReceberEmail(email))) {
        responderJson(res, 400, { erro: "O domínio desse e-mail não foi encontrado." });
        return;
      }
      if (usuarios.some((usuario) => usuario.email === email)) {
        responderJson(res, 409, { erro: "Este e-mail já está cadastrado." });
        return;
      }

      const usuario = {
        id: crypto.randomUUID(),
        nome,
        email,
        senha: criarHashSenha(senha),
        criadoEm: new Date().toISOString(),
      };
      usuarios.push(usuario);
      salvarUsuarios(usuarios);
      responderJson(res, 201, { mensagem: "Cadastro realizado com sucesso." });
      return;
    }

    const usuario = usuarios.find((item) => item.email === email);
    if (!usuario || !conferirSenha(senha, usuario.senha)) {
      responderJson(res, 401, { erro: "E-mail ou senha inválidos." });
      return;
    }

    responderJson(res, 200, {
      mensagem: "Login realizado com sucesso.",
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
  } catch (erro) {
    console.error("Erro na API:", erro.message);
    responderJson(res, 400, { erro: "Não foi possível processar a solicitação." });
  }
}

async function tratarPerfil(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const emailAtual = String(url.searchParams.get("email") || "").trim().toLowerCase();
    const usuarios = lerUsuarios();
    const indice = usuarios.findIndex((usuario) => usuario.email === emailAtual);

    if (indice < 0) {
      responderJson(res, 404, { erro: "Usuário não encontrado." });
      return;
    }

    if (req.method === "GET") {
      responderJson(res, 200, usuarioPublico(usuarios[indice]));
      return;
    }

    const dados = await lerCorpo(req);
    const usuario = usuarios[indice];
    const nome = String(dados.nome || "").trim();
    const novoEmail = String(dados.email || "").trim().toLowerCase();

    if (!nome || !emailTemFormatoValido(novoEmail)) {
      responderJson(res, 400, { erro: "Nome e e-mail válidos são obrigatórios." });
      return;
    }
    if (novoEmail !== emailAtual && usuarios.some((item) => item.email === novoEmail)) {
      responderJson(res, 409, { erro: "Este e-mail já está cadastrado." });
      return;
    }
    if (dados.novaSenha) {
      if (!dados.senhaAtual || !conferirSenha(String(dados.senhaAtual), usuario.senha)) {
        responderJson(res, 401, { erro: "A senha atual está incorreta." });
        return;
      }
      if (String(dados.novaSenha).length < 6) {
        responderJson(res, 400, { erro: "A nova senha deve ter pelo menos 6 caracteres." });
        return;
      }
      usuario.senha = criarHashSenha(String(dados.novaSenha));
    }

    usuario.nome = nome;
    usuario.email = novoEmail;
    if (typeof dados.foto === "string" && dados.foto.length <= 3000000) {
      usuario.foto = dados.foto;
    }
    salvarUsuarios(usuarios);
    responderJson(res, 200, { mensagem: "Perfil atualizado com sucesso.", usuario: usuarioPublico(usuario) });
  } catch (erro) {
    console.error("Erro no perfil:", erro.message);
    responderJson(res, 400, { erro: "Não foi possível atualizar o perfil." });
  }
}

const servidor = http.createServer((req, res) => {
  if ((req.method === "GET" || req.method === "PUT") && req.url.startsWith("/api/perfil")) {
    tratarPerfil(req, res);
    return;
  }

  if (req.method === "POST" && ["/api/cadastro", "/api/login"].includes(req.url)) {
    tratarApi(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD, POST" });
    res.end("Método não permitido");
    return;
  }

  let caminhoArquivo;
  try {
    caminhoArquivo = caminhoDoArquivo(req.url || "/");
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("URL inválida");
    return;
  }

  if (!caminhoArquivo) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acesso negado");
    return;
  }

  fs.stat(caminhoArquivo, (erro, informacoes) => {
    if (erro || !informacoes.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Não encontrado");
      return;
    }

    const ext = path.extname(caminhoArquivo).toLowerCase();
    res.writeHead(200, {
      "Content-Type": tiposMime[ext] || "application/octet-stream",
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    fs.createReadStream(caminhoArquivo).pipe(res);
  });
});

servidor.listen(porta, () => {
  console.log(`Servindo ${pastaProjeto} em http://localhost:${porta}`);
  console.log(`Página inicial: http://localhost:${porta}/`);
});

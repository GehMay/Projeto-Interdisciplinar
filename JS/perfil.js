const usuarioSalvo = localStorage.getItem("trocaticket_usuario");

if (!usuarioSalvo) {
  window.location.href = "login.html";
} else {
  const usuario = JSON.parse(usuarioSalvo);
  const iniciais = (usuario.nome || "TT")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
  const foto = document.querySelector("[data-perfil-foto]");
  const preencherFoto = (valor) => {
    if (valor) {
      foto.textContent = "";
      foto.style.backgroundImage = `url(${valor})`;
      foto.classList.add("perfil-foto_com-imagem");
    } else {
      foto.textContent = iniciais || "TT";
    }
  };

  document.querySelector("[data-perfil-titulo]").textContent = usuario.nome || "Meu perfil";
  document.querySelector("#perfil-nome").value = usuario.nome || "";
  document.querySelector("#perfil-email").value = usuario.email || "";
  document.querySelector("[data-perfil-iniciais]").textContent = iniciais || "TT";
  preencherFoto(usuario.foto);

  const enviarAtualizacao = async (dados, mensagem) => {
    mensagem.textContent = "Salvando...";
    mensagem.className = "perfil-mensagem";
    try {
      const resposta = await fetch(`/api/perfil?email=${encodeURIComponent(usuario.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro);
      localStorage.setItem("trocaticket_usuario", JSON.stringify(resultado.usuario));
      Object.assign(usuario, resultado.usuario);
      mensagem.textContent = resultado.mensagem;
      mensagem.className = "perfil-mensagem perfil-mensagem_sucesso";
      document.querySelector("[data-perfil-titulo]").textContent = usuario.nome;
    } catch (erro) {
      mensagem.textContent = erro.message;
      mensagem.className = "perfil-mensagem perfil-mensagem_erro";
    }
  };

  document.querySelector("[data-perfil-form]").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.currentTarget));
    enviarAtualizacao(dados, document.querySelector("[data-perfil-mensagem]"));
  });

  document.querySelector("[data-senha-form]").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.currentTarget));
    enviarAtualizacao({ ...dados, nome: usuario.nome, email: usuario.email }, document.querySelector("[data-senha-mensagem]"));
    evento.currentTarget.reset();
  });

  document.querySelector("[data-foto-input]").addEventListener("change", (evento) => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    if (arquivo.size > 2000000) {
      alert("Escolha uma imagem de até 2 MB.");
      evento.target.value = "";
      return;
    }
    const leitor = new FileReader();
    leitor.addEventListener("load", () => {
      preencherFoto(leitor.result);
      enviarAtualizacao({ nome: usuario.nome, email: usuario.email, foto: leitor.result }, document.querySelector("[data-perfil-mensagem]"));
    });
    leitor.readAsDataURL(arquivo);
  });
}

document.querySelector("[data-sair]").addEventListener("click", () => {
  localStorage.removeItem("trocaticket_usuario");
  window.location.href = "index.html";
});

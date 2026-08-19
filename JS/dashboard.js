const usuarioSalvo = localStorage.getItem("trocaticket_usuario");

if (!usuarioSalvo) {
  window.location.href = "login.html";
} else {
  const usuario = JSON.parse(usuarioSalvo);
  const nome = usuario.nome || "pessoa usuária";
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");

  document.querySelector("[data-user-name]").textContent = nome.split(" ")[0];
  document.querySelector("[data-user-iniciais]").textContent = iniciais || "TT";
}

document.querySelector("[data-sair]").addEventListener("click", () => {
  localStorage.removeItem("trocaticket_usuario");
  window.location.href = "index.html";
});

const linksDeArea = document.querySelectorAll("[data-area-nav]");

function selecionarArea(area) {
  linksDeArea.forEach((link) => {
    link.classList.toggle("usuario-nav_ativo", link.dataset.areaNav === area);
  });
}

linksDeArea.forEach((link) => {
  link.addEventListener("click", () => {
    selecionarArea(link.dataset.areaNav);
  });
});

const areaInicial = window.location.hash.replace("#", "") || "inicio";
selecionarArea(areaInicial);

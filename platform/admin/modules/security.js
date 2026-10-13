window.ResgataSecurity={

async load(){

const page=document.getElementById("page-security");
if(!page)return;

page.innerHTML=`

<h2>🛡️ Segurança</h2>

<button onclick="ResgataSecurity.load()">
Atualizar
</button>

<div id="security-events">
Carregando eventos...
</div>

`;

const response=await fetch(
"/api/admin/security/events?limit=50",
{
headers:{
Authorization:
"Bearer "+
(localStorage.getItem("resgata_admin_token")||"")
}
});

const data=await response.json();

const events=data.events||[];

document.getElementById("security-events").innerHTML=

events.length ?

events.map(e=>`

<div class="admin-card">

<h3>
${e.type || "Evento"}
</h3>

<p>
Usuário:
${e.user_id||"-"}
</p>

<p>
Risco:
${e.risk||"normal"}
</p>

</div>

`).join("")

:

"Nenhum evento";

}

};


window.loadSecurity =
()=>ResgataSecurity.load();

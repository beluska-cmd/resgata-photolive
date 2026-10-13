window.ResgataSpecialists={

async load(){

const page=document.getElementById("page-specialists");
if(!page)return;

page.innerHTML=`
<h2>👨‍🔧 Especialistas</h2>

<button onclick="ResgataSpecialists.load()">
Atualizar
</button>

<div id="specialists-list">
Carregando...
</div>
`;

const response=await fetch(
"/api/admin/specialists",
{
headers:{
Authorization:
"Bearer "+
(localStorage.getItem("resgata_admin_token")||"")
}
});

const data=await response.json();

const list=data.specialists||[];

document.getElementById("specialists-list").innerHTML=

list.length ?

list.map(s=>`

<div class="admin-card">

<h3>${s.name}</h3>

<p>
Área:
${s.area||"-"}
</p>

<p>
Status:
${s.status||"ativo"}
</p>

</div>

`).join("")

:

"Sem especialistas";

}

};

window.loadSpecialists =
()=>ResgataSpecialists.load();

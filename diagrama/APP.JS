const store = {
  books: [
    {isbn:'1', titulo:'HTML', autor:'Ana'},
    {isbn:'2', titulo:'JavaScript', autor:'Carlos'}
  ],
  users: [
    {matricula:'A1', nome:'João'},
    {matricula:'A2', nome:'Maria'}
  ],
  loans: [],
  fines: [],
  payments: []
};

const $ = s => document.querySelector(s);

function save(){
  localStorage.setItem("biblioteca", JSON.stringify(store));
}

function load(){
  const data = localStorage.getItem("biblioteca");
  if(data) Object.assign(store, JSON.parse(data));
}

function render(){
  renderBooks();
  renderUsers();
  renderLoans();
  renderFines();
  renderPayments();
}

function renderBooks(){
  const grid = $("#booksGrid");
  grid.innerHTML="";
  store.books.forEach(b=>{
    grid.innerHTML+=`<div class="card"><h3>${b.titulo}</h3><p>${b.autor}</p></div>`;
  });
}

function renderUsers(){
  const grid = $("#usersGrid");
  grid.innerHTML="";
  const loanUser=$("#loanUser");
  const payUser=$("#paymentUser");
  loanUser.innerHTML="";
  payUser.innerHTML="";
  store.users.forEach(u=>{
    grid.innerHTML+=`<div class="card"><h3>${u.nome}</h3></div>`;
    loanUser.innerHTML+=`<option value="${u.matricula}">${u.nome}</option>`;
    payUser.innerHTML+=`<option value="${u.matricula}">${u.nome}</option>`;
  });
}

function renderLoans(){
  const tbody=$("#loansTable tbody");
  tbody.innerHTML="";
  store.loans.forEach(l=>{
    const user=store.users.find(u=>u.matricula===l.user);
    const book=store.books.find(b=>b.isbn===l.book);
    tbody.innerHTML+=`
    <tr>
      <td>${l.id}</td>
      <td>${user.nome}</td>
      <td>${book.titulo}</td>
      <td>${l.loanDate}</td>
      <td>${l.returnDate}</td>
      <td>${l.status}</td>
      <td><button onclick="devolver('${l.id}')">Devolver</button></td>
    </tr>`;
  });
}

function devolver(id){
  const l=store.loans.find(x=>x.id===id);
  l.status="Devolvido";

  const hoje=new Date();
  const prazo=new Date(l.returnDate);

  if(hoje>prazo){
    const dias=Math.ceil((hoje-prazo)/86400000);
    const valor=dias*2;
    store.fines.push({
      id:"F"+Date.now(),
      user:l.user,
      valor,
      motivo:`Atraso ${dias} dia(s)`,
      data:new Date().toISOString().slice(0,10),
      status:"Pendente"
    });
    alert("Multa gerada: R$ "+valor);
  }

  save();
  render();
}

function renderFines(){
  const tbody=$("#finesTable tbody");
  tbody.innerHTML="";
  store.fines.forEach(f=>{
    const user=store.users.find(u=>u.matricula===f.user);
    tbody.innerHTML+=`
    <tr>
      <td>${f.id}</td>
      <td>${user.nome}</td>
      <td>R$ ${f.valor}</td>
      <td>${f.motivo}</td>
      <td>${f.data}</td>
      <td>${f.status}</td>
    </tr>`;
  });
}

function renderPayments(){
  const tbody=$("#paymentsTable tbody");
  tbody.innerHTML="";
  store.payments.forEach(p=>{
    const user=store.users.find(u=>u.matricula===p.user);
    tbody.innerHTML+=`
    <tr>
      <td>${p.id}</td>
      <td>${user.nome}</td>
      <td>R$ ${p.valor}</td>
      <td>${p.method}</td>
      <td>${p.data}</td>
    </tr>`;
  });
}

$("#addLoanBtn").addEventListener("click",()=>{
  const user=$("#loanUser").value;
  const book=$("#loanBook")?.value || store.books[0].isbn;

  if(store.fines.some(f=>f.user===user && f.status==="Pendente")){
    alert("Usuário possui multa pendente!");
    return;
  }

  store.loans.push({
    id:"L"+Date.now(),
    user,
    book,
    loanDate:$("#loanDate").value,
    returnDate:$("#returnDate").value,
    status:"Ativo"
  });

  save();
  render();
});

$("#addPaymentBtn").addEventListener("click",()=>{
  const user=$("#paymentUser").value;
  const valor=parseFloat($("#paymentValue").value);

  store.payments.push({
    id:"P"+Date.now(),
    user,
    valor,
    method:$("#paymentMethod").value,
    data:$("#paymentDate").value
  });

  store.fines.forEach(f=>{
    if(f.user===user && f.status==="Pendente")
      f.status="Pago";
  });

  save();
  render();
});

load();
render();
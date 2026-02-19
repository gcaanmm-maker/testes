// app.js (corrigido)
// Armazena dados em memória + localStorage
const store = {
  books: [],
  users: [],
  loans: [],
  reserves: [],
};

const key = 'lib_demo_v1';

function save(){ localStorage.setItem(key, JSON.stringify(store)); }
function load(){
  const raw = localStorage.getItem(key);
  if(raw){ Object.assign(store, JSON.parse(raw)); }
  else { seed(); save(); }
}

function seed(){
  store.books = [
    {isbn:'978-0001', titulo:'Lógica de Programação', autor:'A. Souza', editora:'TechBooks', categoria:'Programação', img:'img/book.png'},
    {isbn:'978-0002', titulo:'HTML & CSS', autor:'B. Lima', editora:'WebPress', categoria:'Web', img:'img/book.png'},
    {isbn:'978-0003', titulo:'JavaScript Básico', autor:'C. Alves', editora:'WebPress', categoria:'Web', img:'img/book.png'},
  ];
  store.users = [
    {matricula:'A100', nome:'João Pereira', img:'img/user.png'},
    {matricula:'A101', nome:'Maria Silva', img:'img/user.png'},
  ];
  store.loans = [];
  store.reserves = [];
}

// ============================
// Utilidades
// ============================
const $ = sel => document.querySelector(sel);

// ✅ CORREÇÃO: handler de eventos deve ser atribuído na propriedade (e.onclick = fn)
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') {
      e.className = v;
    } else if (k === 'html') {
      e.innerHTML = v;
    } else if (k.startsWith('on') && typeof v === 'function') {
      e[k] = v; // ex.: onclick, onchange
    } else {
      e.setAttribute(k, v);
    }
  });
  children.forEach(c => e.appendChild(c));
  return e;
}

function fmtDate(d){ if(!d) return ''; const dt=new Date(d); return dt.toLocaleDateString(); }

// ============================
// LIVROS
// ============================
function renderBooks(){
  const grid = $('#booksGrid');
  grid.innerHTML = '';
  store.books.forEach(b=>{
    grid.appendChild(el('div',{class:'card'},[
      el('img',{src:b.img, alt:'Livro'}),
      el('h3',{html:b.titulo}),
      el('p',{html:`<strong>Autor:</strong> ${b.autor}`}),
      el('p',{html:`<strong>ISBN:</strong> ${b.isbn}`}),
      el('p',{html:`<strong>Editora:</strong> ${b.editora} • <strong>Categoria:</strong> ${b.categoria}`}),
      el('div',{},[
        el('button',{onclick:()=>removeBook(b.isbn)},[document.createTextNode('Remover')])
      ])
    ]));
  });
  // preencher selects
  const loanBook = $('#loanBook');
  const resBook = $('#resBook');
  if(loanBook){ loanBook.innerHTML = ''; }
  if(resBook){ resBook.innerHTML = ''; }
  store.books.forEach(b=>{
    if(loanBook) loanBook.appendChild(el('option',{value:b.isbn, html:`${b.titulo} (${b.isbn})`}));
    if(resBook)  resBook.appendChild(el('option',{value:b.isbn, html:`${b.titulo} (${b.isbn})`}));
  });
}

function addBook(){
  const titulo = $('#bookTitle').value.trim();
  const autor = $('#bookAuthor').value.trim();
  const isbn = $('#bookIsbn').value.trim();
  const editora = $('#bookPublisher').value.trim();
  const categoria = $('#bookCategory').value.trim();
  if(!titulo || !autor || !isbn){ alert('Preencha título, autor e ISBN.'); return; }
  if(store.books.some(b=>b.isbn===isbn)){ alert('ISBN já cadastrado.'); return; }
  store.books.push({isbn,titulo,autor,editora,categoria,img:'img/book.png'});
  save(); renderBooks(); $('#bookTitle').value = $('#bookAuthor').value = $('#bookIsbn').value = $('#bookPublisher').value = $('#bookCategory').value = '';
}
function removeBook(isbn){
  // Não remover se houver empréstimo ativo
  if(store.loans.some(l=>l.bookIsbn===isbn && !l.devolvido)){
    alert('Não é possível remover: existe empréstimo ativo para este livro.'); return;
  }
  store.books = store.books.filter(b=>b.isbn!==isbn); save(); renderBooks(); renderReserves(); renderLoans();
}

// ============================
// USUÁRIOS
// ============================
function renderUsers(){
  const grid = $('#usersGrid');
  grid.innerHTML = '';
  store.users.forEach(u=>{
    grid.appendChild(el('div',{class:'card'},[
      el('img',{src:u.img, alt:'Usuário'}),
      el('h3',{html:u.nome}),
      el('p',{html:`<strong>Matrícula:</strong> ${u.matricula}`}),
      el('div',{},[
        el('button',{onclick:()=>removeUser(u.matricula)},[document.createTextNode('Remover')])
      ])
    ]));
  });
  // preencher selects
  const loanUser = $('#loanUser');
  const resUser = $('#resUser');
  if(loanUser) loanUser.innerHTML = '';
  if(resUser)  resUser.innerHTML = '';
  store.users.forEach(u=>{
    if(loanUser) loanUser.appendChild(el('option',{value:u.matricula, html:`${u.nome} (${u.matricula})`}));
    if(resUser)  resUser.appendChild(el('option',{value:u.matricula, html:`${u.nome} (${u.matricula})`}));
  });
}
function addUser(){
  const nome = $('#userName').value.trim();
  const matricula = $('#userMat').value.trim();
  if(!nome || !matricula){ alert('Preencha nome e matrícula.'); return; }
  if(store.users.some(u=>u.matricula===matricula)){ alert('Matrícula já cadastrada.'); return; }
  store.users.push({nome,matricula,img:'img/user.png'}); save(); renderUsers(); $('#userName').value = $('#userMat').value = '';
}
function removeUser(matricula){
  if(store.loans.some(l=>l.userMatricula===matricula && !l.devolvido)){
    alert('Não é possível remover: usuário possui empréstimo ativo.'); return;
  }
  store.users = store.users.filter(u=>u.matricula!==matricula); save(); renderUsers(); renderLoans(); renderReserves();
}

// ============================
// EMPRÉSTIMOS
// ============================
function addLoan(){
  const userMat = $('#loanUser').value;
  const isbn = $('#loanBook').value;
  const dataEmp = $('#loanDate').value || new Date().toISOString().slice(0,10);
  const dataDev = $('#returnDate').value || new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  // impedir se já estiver emprestado sem devolução
  if(store.loans.some(l=>l.bookIsbn===isbn && !l.devolvido)){
    alert('Este livro já está emprestado.'); return;
  }
  const id = 'L' + Math.random().toString(36).slice(2,7).toUpperCase();
  store.loans.push({id, userMatricula:userMat, bookIsbn:isbn, dataEmp, dataDev, devolvido:false, multa:0});
  save(); renderLoans();
}
function devolver(id){
  const l = store.loans.find(x=>x.id===id);
  if(!l) return;
  if(l.devolvido) return;
  const hoje = new Date();
  const prazo = new Date(l.dataDev);
  l.devolvido = true;
  if(hoje>prazo){
    const dias = Math.ceil((hoje-prazo)/86400000);
    l.multa = dias * 2.0; // R$2 por dia de atraso
    alert(`Devolvido com atraso de ${dias} dia(s). Multa: R$ ${l.multa.toFixed(2)}`);
  }
  save(); renderLoans();
}

function renderLoans(){
  const tbody = $('#loansTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  store.loans.forEach(l=>{
    const user = store.users.find(u=>u.matricula===l.userMatricula);
    const book = store.books.find(b=>b.isbn===l.bookIsbn);
    const tr = el('tr',{},[
      el('td',{},[el('img',{src:'img/loan.png', alt:'Empréstimo'})]),
      el('td',{html:user?user.nome:''}),
      el('td',{html:book?book.titulo:''}),
      el('td',{html:fmtDate(l.dataEmp)}),
      el('td',{html:fmtDate(l.dataDev)}),
      el('td',{html:l.devolvido ? (l.multa>0?`Devolvido • Multa R$ ${l.multa.toFixed(2)}`:'Devolvido') : 'Ativo'}),
      el('td',{class:'actions'},[
        l.devolvido ? el('span',{html:'—'}) : el('button',{onclick:()=>devolver(l.id)},[document.createTextNode('Registrar Devolução')])
      ])
    ]);
    tbody.appendChild(tr);
  });
}

// ============================
// RESERVAS
// ============================
function addReserve(){
  const userMat = $('#resUser').value;
  const isbn = $('#resBook').value;
  const data = $('#resDate').value || new Date().toISOString().slice(0,10);
  const id = 'R' + Math.random().toString(36).slice(2,7).toUpperCase();
  store.reserves.push({id, userMatricula:userMat, bookIsbn:isbn, data});
  save(); renderReserves();
}
function cancelarReserva(id){
  store.reserves = store.reserves.filter(r=>r.id!==id); save(); renderReserves();
}
function renderReserves(){
  const tbody = $('#resTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  store.reserves.forEach(r=>{
    const user = store.users.find(u=>u.matricula===r.userMatricula);
    const book = store.books.find(b=>b.isbn===r.bookIsbn);
    const tr = el('tr',{},[
      el('td',{},[el('img',{src:'img/reserve.png', alt:'Reserva'})]),
      el('td',{html:user?user.nome:''}),
      el('td',{html:book?book.titulo:''}),
      el('td',{html:fmtDate(r.data)}),
      el('td',{class:'actions'},[
        el('button',{onclick:()=>cancelarReserva(r.id)},[document.createTextNode('Cancelar')])
      ])
    ]);
    tbody.appendChild(tr);
  });
}

// ============================
// Eventos / Inicialização
// ============================
function wire(){
  const addBookBtn = document.getElementById('addBookBtn');
  const addUserBtn = document.getElementById('addUserBtn');
  const addLoanBtn = document.getElementById('addLoanBtn');
  const addResBtn = document.getElementById('addResBtn');
  if(addBookBtn) addBookBtn.addEventListener('click', addBook);
  if(addUserBtn) addUserBtn.addEventListener('click', addUser);
  if(addLoanBtn) addLoanBtn.addEventListener('click', addLoan);
  if(addResBtn) addResBtn.addEventListener('click', addReserve);
}

// Boot
load();
wire();
renderBooks();
renderUsers();
renderLoans();
renderReserves();

// admin.js
let db = { preceptores: [], turmas: [], alunos: [], frequencias: {}, atividades: {}, calendario: {}, galeria: [] };
let chartInstance = null;
let tipoEditando = null, idEditando = null;
let calDataAtual = new Date(), modoVisCalendario = 'mes';

window.onload = async () => {
    let { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await iniciarAppAdmin();
    } else {
        mostrarLogin();
    }
    document.getElementById('loading-inicial').classList.add('hidden');
};

function mostrarLogin() { 
    document.getElementById('screen-login').classList.replace('hidden', 'flex'); 
    document.getElementById('screen-app').classList.add('hidden');
    document.getElementById('screen-app').classList.remove('flex');
}

async function fazerLoginAdmin() {
    let email = document.getElementById('login-admin-email').value.trim();
    let p = document.getElementById('login-admin-pass').value.trim();
    let btn = document.getElementById('btn-login-admin');
    
    btn.disabled = true; btn.innerText = "A verificar...";
    
    let { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: p });
    
    if (error) {
        showNotification('Credenciais inválidas!', true);
        btn.disabled = false; btn.innerText = "Entrar no Painel";
    } else {
        await iniciarAppAdmin();
    }
}

async function logoutAdmin() {
    await supabaseClient.auth.signOut();
    mostrarLogin();
}

async function iniciarAppAdmin() {
    document.getElementById('screen-login').classList.replace('flex', 'hidden');
    document.getElementById('screen-app').classList.remove('hidden');
    document.getElementById('screen-app').classList.add('flex');
    
    await carregarDadosRelacionais();
    iniciarRealtimeRelacional();
    renderTodosOsDados();
}

async function carregarDadosRelacionais() {
    try {
        const [pRes, tRes, aRes, fRes, atRes, cRes, gRes] = await Promise.all([
            supabaseClient.from('preceptores').select('*'),
            supabaseClient.from('turmas').select('*'),
            supabaseClient.from('alunos').select('*'),
            supabaseClient.from('frequencias').select('*'),
            supabaseClient.from('atividades').select('*'),
            supabaseClient.from('calendario').select('*'),
            supabaseClient.from('galeria').select('*')
        ]);

        db.preceptores = pRes.data || [];
        db.turmas = tRes.data || [];
        db.alunos = aRes.data || [];

        db.frequencias = {};
        (fRes.data || []).forEach(item => {
            if(!db.frequencias[item.turma_id]) db.frequencias[item.turma_id] = {};
            if(!db.frequencias[item.turma_id][item.data]) db.frequencias[item.turma_id][item.data] = {};
            db.frequencias[item.turma_id][item.data][item.aluno_id] = item.horas;
        });

        db.atividades = {};
        (atRes.data || []).forEach(item => {
            if(!db.atividades[item.turma_id]) db.atividades[item.turma_id] = {};
            db.atividades[item.turma_id][item.data] = { colunas: item.colunas || [], notas: item.notas || {} };
        });

        db.calendario = {};
        (cRes.data || []).forEach(item => {
            db.calendario[item.turma_id] = item.dados || {};
        });

        db.galeria = gRes.data || [];
    } catch (err) {
        showNotification("Erro ao carregar os dados. Verifique a ligação.", true);
    }
}

function iniciarRealtimeRelacional() {
    supabaseClient.channel('tabelas_relacionais')
        .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
            await carregarDadosRelacionais();
            renderTodosOsDados();
        })
        .subscribe();
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.replace('block', 'hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.replace('hidden', 'block');
    btnElement.classList.add('active');
    if(tabId === 'calendario') carregarCalendarioTurma();
}

function renderTodosOsDados() {
    updateDashboard();
    renderSelects();
    renderTabelasGerais();
    if(!document.getElementById('tab-calendario').classList.contains('hidden')) carregarCalendarioTurma();
    if(!document.getElementById('tab-master').classList.contains('hidden')) renderizarTabelaMaster();
}

function renderSelects() {
    const selPrec = document.getElementById('turma-preceptor').value;
    const selAlunoTurma = document.getElementById('aluno-turma').value;
    const selImportTurma = document.getElementById('import-turma').value;
    const selCalTurma = document.getElementById('cal-select-turma').value;
    const selMasterTurma = document.getElementById('master-turma').value;

    let pOpts = '<option value="">Selecione...</option>'; 
    db.preceptores.forEach(p => pOpts += `<option value="${p.id}">${escapeHTML(p.nome)}</option>`);
    document.getElementById('turma-preceptor').innerHTML = pOpts;
    if(selPrec) document.getElementById('turma-preceptor').value = selPrec;
    
    let tOpts = '<option value="">Selecione...</option>'; 
    let turmasAtivas = db.turmas.filter(t => t.status !== 'finalizada');
    turmasAtivas.forEach(t => tOpts += `<option value="${t.id}">${escapeHTML(t.nome)} (${escapeHTML(t.turno||'Integral')})</option>`);
    
    document.getElementById('aluno-turma').innerHTML = tOpts;
    if(selAlunoTurma) document.getElementById('aluno-turma').value = selAlunoTurma;
    
    document.getElementById('import-turma').innerHTML = tOpts;
    if(selImportTurma) document.getElementById('import-turma').value = selImportTurma;
    
    document.getElementById('cal-select-turma').innerHTML = tOpts;
    if(selCalTurma) document.getElementById('cal-select-turma').value = selCalTurma;
    
    document.getElementById('master-turma').innerHTML = tOpts;
    if(selMasterTurma) document.getElementById('master-turma').value = selMasterTurma;
}

function renderTabelasGerais() {
    document.getElementById('list-preceptores').innerHTML = db.preceptores.map(p => `<tr class="hover:bg-gray-50"><td class="p-4 font-bold">${escapeHTML(p.nome)}</td><td class="p-4">${escapeHTML(p.login)}</td><td class="p-4 text-right"><button onclick="abrirEditar('prec', '${p.id}')" class="text-orange-500 mx-2"><i class="fas fa-edit"></i></button><button onclick="apagarRegistro('preceptores', '${p.id}')" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="3" class="p-4 text-center">Nenhum preceptor</td></tr>';
    
    let turmasAtivas = db.turmas.filter(t => t.status !== 'finalizada');
    let turmasFinalizadas = db.turmas.filter(t => t.status === 'finalizada');

    document.getElementById('list-turmas').innerHTML = turmasAtivas.map(t => { 
        let p = db.preceptores.find(pr => pr.id === t.preceptor_id); 
        return `<tr class="hover:bg-gray-50"><td class="p-4 font-bold">${escapeHTML(t.nome)} <br><span class="text-xs text-purple-600">${escapeHTML(t.turno||'Integral')}</span></td><td class="p-4 text-xs">${formatData(t.inicio)} a ${formatData(t.fim)}</td><td class="p-4">${p?escapeHTML(p.nome):'-'}</td><td class="p-4 text-right"><button onclick="finalizarTurma('${t.id}')" title="Finalizar Turma" class="text-green-600 mx-1"><i class="fas fa-check-circle"></i></button><button onclick="abrirRelatorioTurma('${t.id}')" class="text-purple-600 mx-1"><i class="fas fa-list"></i></button><button onclick="abrirEditar('turma', '${t.id}')" class="text-orange-500 mx-1"><i class="fas fa-edit"></i></button><button onclick="apagarRegistro('turmas', '${t.id}')" class="text-red-500 mx-1"><i class="fas fa-trash"></i></button></td></tr>`; 
    }).join('') || '<tr><td colspan="4" class="p-4 text-center">Nenhuma turma ativa</td></tr>';

    document.getElementById('list-turmas-finalizadas').innerHTML = turmasFinalizadas.map(t => { 
        let p = db.preceptores.find(pr => pr.id === t.preceptor_id); 
        return `<tr class="hover:bg-gray-50 opacity-70"><td class="p-4 font-bold text-gray-600">${escapeHTML(t.nome)} <br><span class="text-xs">${escapeHTML(t.turno||'Integral')}</span></td><td class="p-4 text-xs">${formatData(t.inicio)} a ${formatData(t.fim)}</td><td class="p-4">${p?escapeHTML(p.nome):'-'}</td><td class="p-4 text-right"><button onclick="abrirRelatorioTurma('${t.id}')" class="text-purple-600 mx-1 bg-purple-100 px-3 py-1 rounded">Ver Relatório</button><button onclick="apagarRegistro('turmas', '${t.id}')" class="text-red-500 mx-1"><i class="fas fa-trash"></i></button></td></tr>`; 
    }).join('') || '<tr><td colspan="4" class="p-4 text-center">Nenhuma turma finalizada</td></tr>';

    document.getElementById('list-alunos').innerHTML = db.alunos.map(a => { 
        let t = db.turmas.find(tr => tr.id === a.turma_id); 
        return `<tr class="hover:bg-gray-50"><td class="p-4 font-bold">${escapeHTML(a.nome)}</td><td class="p-4">${t?escapeHTML(t.nome):'-'}</td><td class="p-4 text-right"><button onclick="abrirRelatorioAluno('${a.id}')" class="text-purple-600 mx-2"><i class="fas fa-chart-bar"></i></button><button onclick="abrirEditar('aluno', '${a.id}')" class="text-orange-500 mx-2"><i class="fas fa-edit"></i></button><button onclick="apagarRegistro('alunos', '${a.id}')" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`; 
    }).join('') || '<tr><td colspan="3" class="p-4 text-center">Nenhum aluno</td></tr>';
    
    document.getElementById('grid-galeria').innerHTML = db.galeria.map(f => { 
        let t = db.turmas.find(x => x.id === f.turma_id); 
        return `<div class="bg-white rounded-lg shadow border flex flex-col"><img src="${escapeHTML(f.imagem_url)}" class="w-full h-48 object-cover border-b"><div class="p-4 flex-1 flex flex-col"><p class="font-bold text-sm mb-2">${escapeHTML(f.descricao)}</p><div class="text-xs text-gray-500 mb-2">${t?escapeHTML(t.nome):'Geral'}</div><button onclick="apagarRegistro('galeria', '${f.id}')" class="mt-auto text-red-500 border border-red-200 rounded py-1.5 hover:bg-red-500 hover:text-white transition">Apagar</button></div></div>`; 
    }).join('') || '<div class="col-span-full text-center py-10 text-gray-400">Nenhuma foto no Storage.</div>';
}

async function finalizarTurma(id) {
    if (confirm("Tem certeza que deseja finalizar esta turma? Ela irá para o histórico e sumirá do app dos preceptores.")) {
        const { error } = await supabaseClient.from('turmas').update({ status: 'finalizada' }).eq('id', id);
        if (error) return alert('Erro ao finalizar: ' + error.message);
        showNotification('Turma finalizada e movida para o histórico!');
        await carregarDadosRelacionais(); 
        renderTodosOsDados();
    }
}

async function salvarPreceptor() {
    let nome = document.getElementById('prec-nome').value.trim();
    let email = document.getElementById('prec-login').value.trim();
    let senha = document.getElementById('prec-senha').value.trim();
    let btn = document.getElementById('btn-salvar-prec');
    
    if (!senha || senha.length < 6) return alert('A palavra-passe precisa de ter pelo menos 6 carateres.');

    btn.disabled = true; btn.innerText = "A Criar Acesso...";

    try {
        const { data, error } = await supabaseClient.functions.invoke('criar-preceptor', {
            body: { nome, email, senha }
        });

        if (error || (data && data.error)) throw new Error(error ? error.message : data.error);

        showNotification('Preceptor e acesso Auth criados com sucesso!');
        document.getElementById('form-preceptor').reset();
        await carregarDadosRelacionais(); 
        renderTodosOsDados();
    } catch (err) {
        alert('Erro ao criar preceptor: ' + err.message);
    } finally {
        btn.disabled = false; btn.innerText = "Adicionar Perfil & Login";
    }
}

function abrirEditar(tipo, id) {
    tipoEditando = tipo; idEditando = id; let cont = document.getElementById('campos-editar'), obj;
    
    if (tipo === 'prec') { 
        obj = db.preceptores.find(p => p.id === id); 
        cont.innerHTML = `
            <label class="block text-sm font-bold">Nome</label>
            <input type="text" id="edit-nome" value="${escapeHTML(obj.nome)}" class="w-full p-2 border rounded mb-3">
            <label class="block text-sm font-bold">E-mail</label>
            <input type="email" id="edit-login" value="${escapeHTML(obj.login)}" class="w-full p-2 border rounded mb-3">
            <label class="block text-sm font-bold text-orange-600">Nova Palavra-passe <span class="text-xs font-normal text-gray-500">(Opcional)</span></label>
            <input type="password" id="edit-senha" placeholder="Mínimo 6 carateres. Deixe em branco se não quiser mudar." class="w-full p-2 border rounded border-orange-200 focus:border-orange-500">
        `; 
    }
    else if (tipo === 'turma') { obj = db.turmas.find(t => t.id === id); let pOpts = ''; db.preceptores.forEach(p => pOpts += `<option value="${p.id}" ${p.id===obj.preceptor_id?'selected':''}>${escapeHTML(p.nome)}</option>`); cont.innerHTML = `<label class="block text-sm font-bold">Nome</label><input type="text" id="edit-nome" value="${escapeHTML(obj.nome)}" class="w-full p-2 border rounded mb-2"><label class="block text-sm font-bold">Preceptor</label><select id="edit-prec" class="w-full p-2 border rounded">${pOpts}</select>`; }
    else if (tipo === 'aluno') { obj = db.alunos.find(a => a.id === id); let tOpts = ''; db.turmas.forEach(t => tOpts += `<option value="${t.id}" ${t.id===obj.turma_id?'selected':''}>${escapeHTML(t.nome)}</option>`); cont.innerHTML = `<label class="block text-sm font-bold">Nome</label><input type="text" id="edit-nome" value="${escapeHTML(obj.nome)}" class="w-full p-2 border rounded mb-2"><label class="block text-sm font-bold">Turma</label><select id="edit-turma" class="w-full p-2 border rounded">${tOpts}</select>`; }
    
    document.getElementById('modal-editar').classList.remove('hidden');
}

async function salvarEdicao() {
    let btn = document.getElementById('btn-salvar-edicao');
    btn.disabled = true; btn.innerText = "A Salvar...";

    try {
        if(tipoEditando === 'prec') { 
            let nNome = document.getElementById('edit-nome').value.trim();
            let nEmail = document.getElementById('edit-login').value.trim();
            let nSenha = document.getElementById('edit-senha').value.trim();
            
            const { data, error } = await supabaseClient.functions.invoke('editar-preceptor', {
                body: { id: idEditando, nome: nNome, email: nEmail, senha: nSenha }
            });

            if (error || (data && data.error)) throw new Error(error ? error.message : data.error);
        } 
        else if(tipoEditando === 'turma') { 
            await supabaseClient.from('turmas').update({ nome: document.getElementById('edit-nome').value, preceptor_id: document.getElementById('edit-prec').value }).eq('id', idEditando); 
        } 
        else if(tipoEditando === 'aluno') { 
            await supabaseClient.from('alunos').update({ nome: document.getElementById('edit-nome').value, turma_id: document.getElementById('edit-turma').value }).eq('id', idEditando); 
        }
        
        document.getElementById('modal-editar').classList.add('hidden'); 
        showNotification('Atualizado com sucesso!');
        await carregarDadosRelacionais(); renderTodosOsDados();
    } catch (err) {
        alert('Erro ao atualizar: ' + err.message);
    } finally {
        btn.disabled = false; btn.innerText = "Salvar";
    }
}

async function salvarTurma() {
    const novo = { id: 'turma_' + Date.now(), nome: document.getElementById('turma-nome').value, preceptor_id: document.getElementById('turma-preceptor').value, turno: document.getElementById('turma-turno').value, inicio: document.getElementById('turma-inicio').value, fim: document.getElementById('turma-fim').value, status: 'ativa' };
    const { error } = await supabaseClient.from('turmas').insert([novo]);
    if(error) return alert('Erro: ' + error.message);
    document.getElementById('form-turma').reset();
    showNotification('Turma criada!');
    await carregarDadosRelacionais(); renderTodosOsDados();
}

async function salvarAluno() {
    const novo = { id: 'aluno_' + Date.now(), nome: document.getElementById('aluno-nome').value, turma_id: document.getElementById('aluno-turma').value, status: 'ativo' };
    const { error } = await supabaseClient.from('alunos').insert([novo]);
    if(error) return alert('Erro: ' + error.message);
    document.getElementById('form-aluno').reset();
    showNotification('Aluno adicionado!');
    await carregarDadosRelacionais(); renderTodosOsDados();
}

async function apagarRegistro(tabela, id) {
    if(confirm("Apagar permanentemente?")) {
        const { error } = await supabaseClient.from(tabela).delete().eq('id', id);
        if(error) return alert('Erro: ' + error.message);
        showNotification('Apagado!');
        await carregarDadosRelacionais(); renderTodosOsDados();
    }
}

async function importarCSV() {
    const tId = document.getElementById('import-turma').value; 
    const file = document.getElementById('file-csv').files[0];
    if(!tId || !file) return alert('Selecione turma e ficheiro!');
    const r = new FileReader(); 
    r.onload = async function(e) { 
        let nomes = e.target.result.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
        let novosAlunos = nomes.map((nome, idx) => ({ id: 'aluno_' + Date.now() + '_' + idx, nome, turma_id: tId, status: 'ativo' }));
        const { error } = await supabaseClient.from('alunos').insert(novosAlunos);
        if(error) return alert('Erro na importação: ' + error.message);
        document.getElementById('file-csv').value = ''; 
        showNotification('Alunos importados com sucesso!');
        await carregarDadosRelacionais(); renderTodosOsDados();
    }; 
    r.readAsText(file);
}

function calcularFrequenciaAluno(aId) {
    let pos=0, pres=0, fts=0;
    Object.keys(db.frequencias).forEach(tId => Object.values(db.frequencias[tId]).forEach(dia => { 
        let r = dia[aId]; 
        if(r && r.some(v => v === 'P' || v === 'F')) { 
            pos += 6; pres += r.filter(v => v === 'P').length; fts += r.filter(v => v === 'F').length; 
        } 
    }));
    return { pos, pres, faltas: fts, percent: pos > 0 ? ((pres/pos)*100).toFixed(1) : 0 };
}

function calcularNotasAluno(aId, tId) {
    let tot = 0, hist = []; 
    if(db.atividades[tId]) {
        Object.keys(db.atividades[tId]).forEach(d => { 
            if(db.atividades[tId][d].notas && db.atividades[tId][d].notas[aId]) {
                db.atividades[tId][d].colunas.forEach(c => { 
                    let v = parseFloat(String(db.atividades[tId][d].notas[aId][c.id]).replace(',','.')); 
                    if(!isNaN(v)) { tot += v; hist.push({ data: d, atividade: c.nome, nota: v }); } 
                }); 
            }
        });
    }
    return { total: tot, historico: hist };
}

function updateDashboard() {
    document.getElementById('dash-preceptores').innerText = db.preceptores.length; 
    let turmasAtivas = db.turmas.filter(t => t.status !== 'finalizada');
    document.getElementById('dash-turmas').innerText = turmasAtivas.length; 
    document.getElementById('dash-alunos').innerText = db.alunos.length;
    
    let labels = [], dados = [], cores = [], htmlR = ''; 
    let rsc = db.alunos.map(a => ({...a, f: calcularFrequenciaAluno(a.id).faltas})).filter(a => a.f >= 18).sort((a,b) => b.f - a.f);
    
    rsc.forEach(a => { 
        let t = db.turmas.find(tr => tr.id === a.turma_id); 
        htmlR += `<li class="py-2 flex justify-between items-center"><div class="flex flex-col"><span class="font-bold ${a.f>=30?'text-red-700':'text-orange-600'}">${escapeHTML(a.nome)}</span><span class="text-[10px] text-gray-500">${t?escapeHTML(t.nome):'-'}</span></div> <span class="${a.f>=30?'bg-red-600':'bg-orange-500'} text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">${a.f>=30?'ESTOUROU':'RISCO'} (${a.f}h)</span></li>`; 
    });
    document.getElementById('lista-risco').innerHTML = htmlR || '<li class="py-4 text-gray-500 text-center text-xs">Nenhum aluno em risco.</li>';
    
    turmasAtivas.forEach(t => { 
        let pT=0, prT=0; 
        db.alunos.filter(a => a.turma_id === t.id).forEach(a => { let f = calcularFrequenciaAluno(a.id); pT += f.pos; prT += f.pres; }); 
        let p = pT > 0 ? ((prT/pT)*100).toFixed(1) : 0; 
        labels.push(t.nome); dados.push(p); 
        cores.push(pT===0 ? '#E5E7EB' : (p >= 75 ? 'rgba(88, 28, 135, 0.8)' : 'rgba(249, 115, 22, 0.8)')); 
    });
    
    if(chartInstance) chartInstance.destroy(); 
    chartInstance = new Chart(document.getElementById('graficoFrequencia').getContext('2d'), { type: 'bar', data: { labels, datasets: [{ data: dados, backgroundColor: cores }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 100 } }, plugins: { legend: { display: false } } } });
}

function checkFeriado(isoStr) { 
    let ano = parseInt(isoStr.split('-')[0]);
    if (!cacheFeriados[ano]) {
        let f = {};
        f[`${ano}-01-01`] = "Confraternização Universal"; f[`${ano}-04-21`] = "Tiradentes";
        f[`${ano}-05-01`] = "Dia do Trabalhador"; f[`${ano}-09-07`] = "Independência do Brasil";
        f[`${ano}-10-12`] = "Nossa Senhora Aparecida"; f[`${ano}-11-02`] = "Finados";
        f[`${ano}-11-15`] = "Proclamação da República"; f[`${ano}-12-25`] = "Natal";
        
        let a = ano % 19, b = Math.floor(ano/100), c = ano % 100;
        let d = Math.floor(b/4), e = b % 4, f_ = Math.floor((b+8)/25);
        let g = Math.floor((b-f_+1)/3), h = (19*a + b - d - g + 15) % 30;
        let i = Math.floor(c/4), k = c % 4, l = (32 + 2*e + 2*i - h - k) % 7;
        let m = Math.floor((a + 11*h + 22*l)/451);
        let mes = Math.floor((h + l - 7*m + 114)/31), dia = ((h + l - 7*m + 114) % 31) + 1;
        let pascoa = new Date(ano, mes-1, dia);
        let addD = (dt, dd) => { let nd = new Date(dt); nd.setDate(nd.getDate() + dd); return `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`; };
        
        f[addD(pascoa, -47)] = "Carnaval"; f[addD(pascoa, -2)] = "Sexta-feira Santa";
        f[addD(pascoa, 0)] = "Páscoa"; f[addD(pascoa, 60)] = "Corpus Christi";
        cacheFeriados[ano] = f;
    }
    return cacheFeriados[ano][isoStr]; 
}

function carregarCalendarioTurma() {
    const tId = document.getElementById('cal-select-turma').value;
    const area = document.getElementById('area-painel-calendario');
    if(!tId) { area.classList.add('hidden'); document.getElementById('cal-preceptor-nome').value = ''; document.getElementById('cal-total-dias').innerText = '0'; return; }
    
    const turma = db.turmas.find(t => t.id === tId);
    const prec = db.preceptores.find(p => p.id === turma.preceptor_id);
    document.getElementById('cal-preceptor-nome').value = prec ? escapeHTML(prec.nome) : 'Não vinculado';
    
    area.classList.remove('hidden');
    renderizarCalendario();
}

function setVisCalendario(modo) {
    modoVisCalendario = modo;
    let btnMes = document.getElementById('btn-vis-mes');
    let btnEmpilhado = document.getElementById('btn-vis-empilhado');
    let btnLista = document.getElementById('btn-vis-lista');
    let activeClass = 'px-3 py-1.5 text-sm font-bold rounded shadow-sm bg-white text-purple-700 transition';
    let inactiveClass = 'px-3 py-1.5 text-sm font-bold rounded text-gray-500 hover:text-purple-700 transition bg-transparent';
    btnMes.className = modo === 'mes' ? activeClass : inactiveClass;
    btnEmpilhado.className = modo === 'empilhado' ? activeClass : inactiveClass;
    btnLista.className = modo === 'lista' ? activeClass : inactiveClass;
    renderizarCalendario();
}

async function gerarDiasBase() {
    const tId = document.getElementById('cal-select-turma').value;
    const turma = db.turmas.find(t => t.id === tId);
    if(!turma.inicio || !turma.fim) return alert('Esta turma precisa ter Início e Fim!');
    const checks = document.querySelectorAll('.check-dia:checked');
    const diasSel = Array.from(checks).map(c => parseInt(c.value));
    if(diasSel.length === 0) return alert('Selecione pelo menos um dia!');
    
    if(!db.calendario[tId]) db.calendario[tId] = {};
    let curr = new Date(turma.inicio + 'T00:00:00');
    let fim = new Date(turma.fim + 'T00:00:00');
    while(curr <= fim) {
        let isoStr = curr.toISOString().split('T')[0];
        if(diasSel.includes(curr.getDay()) && !checkFeriado(isoStr)) {
            db.calendario[tId][isoStr] = { status: 'agendada', justificativa: '' };
        }
        curr.setDate(curr.getDate() + 1);
    }
    await supabaseClient.from('calendario').upsert({ turma_id: tId, dados: db.calendario[tId] }, { onConflict: 'turma_id' });
    showNotification('Dias aplicados!');
    await carregarDadosRelacionais(); renderizarCalendario();
}

async function salvarCronogramaBase() {
    const tId = document.getElementById('cal-select-turma').value;
    if(!db.calendario[tId]) db.calendario[tId] = {};
    db.calendario[tId]['_status'] = 'salvo';
    await supabaseClient.from('calendario').upsert({ turma_id: tId, dados: db.calendario[tId] }, { onConflict: 'turma_id' });
    showNotification('Cronograma Oficializado!');
    await carregarDadosRelacionais(); renderizarCalendario();
}

async function desbloquearCronograma() {
    const tId = document.getElementById('cal-select-turma').value;
    if(db.calendario[tId]) {
        delete db.calendario[tId]['_status'];
        await supabaseClient.from('calendario').upsert({ turma_id: tId, dados: db.calendario[tId] }, { onConflict: 'turma_id' });
        showNotification('Modo Criação liberado!');
        await carregarDadosRelacionais(); renderizarCalendario();
    }
}

function mudarMes(direcao) { calDataAtual.setMonth(calDataAtual.getMonth() + direcao); renderizarCalendario(); }

async function clicarDiaCalendario(isoStr) {
    const tId = document.getElementById('cal-select-turma').value;
    const turma = db.turmas.find(t => t.id === tId);
    if(!tId || !turma) return;
    if(!db.calendario[tId]) db.calendario[tId] = {};
    let isSalvo = db.calendario[tId]['_status'] === 'salvo';
    let aula = db.calendario[tId][isoStr];
    
    if (!isSalvo) {
        if (aula && aula.status === 'agendada') delete db.calendario[tId][isoStr];
        else db.calendario[tId][isoStr] = { status: 'agendada', justificativa: '' };
    } else {
        if(aula && aula.status === 'agendada') {
            let motivo = prompt("Justificativa para o cancelamento:", "Imprevisto");
            if(motivo !== null) db.calendario[tId][isoStr] = { status: 'cancelada', justificativa: motivo || 'Cancelada' }; else return;
        } else if(aula && (aula.status === 'cancelada' || aula.status === 'remarcada')) {
            delete db.calendario[tId][isoStr];
        } else {
            db.calendario[tId][isoStr] = { status: 'remarcada', justificativa: 'Aula Remarcada/Extra' };
        }
    }
    await supabaseClient.from('calendario').upsert({ turma_id: tId, dados: db.calendario[tId] }, { onConflict: 'turma_id' });
    await carregarDadosRelacionais(); renderizarCalendario();
}

function renderizarCalendario() {
    const tId = document.getElementById('cal-select-turma').value;
    const turma = db.turmas.find(t => t.id === tId);
    if(!turma) return;
    let isSalvo = (db.calendario[tId] && db.calendario[tId]['_status'] === 'salvo');
    
    let totalPeriodo = 0;
    if(db.calendario[tId]) {
        Object.keys(db.calendario[tId]).forEach(k => {
            if(k !== '_status' && ['agendada','remarcada'].includes(db.calendario[tId][k].status)) totalPeriodo++;
        });
    }
    document.getElementById('cal-total-dias').innerText = totalPeriodo;

    let painelHtml = isSalvo ? `<div><h3 class="font-bold text-gray-700 text-sm"><i class="fas fa-lock text-green-600"></i> Oficializado</h3></div><button onclick="desbloquearCronograma()" class="bg-gray-100 border text-gray-700 px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-gray-200"><i class="fas fa-unlock"></i> Desbloquear</button>` : `<div><h3 class="font-bold text-orange-600 text-sm"><i class="fas fa-pencil-alt"></i> Modo Criação</h3></div><div class="flex flex-wrap items-center gap-4"><div class="flex gap-2 text-sm font-semibold bg-gray-50 p-2 rounded border"><label><input type="checkbox" class="check-dia" value="1"> Seg</label><label><input type="checkbox" class="check-dia" value="2"> Ter</label><label><input type="checkbox" class="check-dia" value="3"> Qua</label><label><input type="checkbox" class="check-dia" value="4"> Qui</label><label><input type="checkbox" class="check-dia" value="5"> Sex</label><label><input type="checkbox" class="check-dia" value="6"> Sáb</label></div><button onclick="gerarDiasBase()" class="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold shadow">Preencher</button><button onclick="salvarCronogramaBase()" class="bg-green-600 text-white px-5 py-2 rounded text-sm font-bold shadow"><i class="fas fa-save"></i> Oficializar</button></div>`;
    document.getElementById('painel-controle-calendario').innerHTML = painelHtml;
    
    document.getElementById('legenda-calendario').innerHTML = `<span class="flex items-center gap-2"><span class="w-4 h-4 bg-green-500 rounded"></span> Agendada</span><span class="flex items-center gap-2"><span class="w-4 h-4 bg-red-500 rounded"></span> Cancelada</span><span class="flex items-center gap-2"><span class="w-4 h-4 bg-blue-500 rounded"></span> Remarcada</span>`;
    
    ['view-grid', 'view-empilhado', 'view-lista'].forEach(id => document.getElementById(id).classList.replace('block', 'hidden'));
    if(modoVisCalendario === 'mes') { document.getElementById('view-grid').classList.replace('hidden', 'block'); renderizarViewMes(tId, turma); }
    else if(modoVisCalendario === 'empilhado') { document.getElementById('view-empilhado').classList.replace('hidden', 'block'); renderizarViewEmpilhado(tId, turma); }
    else { document.getElementById('view-lista').classList.replace('hidden', 'block'); renderizarViewListaCompleta(tId, turma); }
}

function gerarBlocoDia(d, isoStr, dentro, aula, isLista = false) {
    let feriado = checkFeriado(isoStr);
    let cor = "bg-gray-50 text-gray-600 border-gray-200", status = "Livre";
    if(!dentro) { cor = "bg-red-50 text-red-300 border-red-100 opacity-40"; status = "Fora"; }
    else if(aula && aula.status) {
        if(aula.status === 'agendada') { cor = "bg-green-500 text-white font-bold border-green-600"; status = "Agendada"; }
        else if(aula.status === 'cancelada') { cor = "bg-red-500 text-white font-bold border-red-600"; status = "Cancelada"; }
        else if(aula.status === 'remarcada') { cor = "bg-blue-500 text-white font-bold border-blue-600"; status = "Remarcada"; }
    } else if (feriado) { cor = "bg-yellow-100 text-yellow-800 border-yellow-300"; status = "Feriado"; }
    
    let just = aula?.justificativa || feriado || "";
    let onclick = dentro ? `onclick="clicarDiaCalendario('${isoStr}')"` : '';
    let cursor = dentro ? "cursor-pointer hover:scale-105" : "";
    
    if(isLista) {
        let badge = "bg-gray-200 text-gray-600";
        if(aula?.status === 'agendada') badge = "bg-green-100 text-green-700";
        else if(aula?.status === 'cancelada') badge = "bg-red-100 text-red-700";
        else if(aula?.status === 'remarcada') badge = "bg-blue-100 text-blue-700";
        return `<div ${onclick} class="flex justify-between items-center p-3 border rounded ${cursor} transition ${cor}"><div class="flex items-center gap-4"><span class="font-bold w-24">${formatData(isoStr)}</span>${just ? `<span class="text-xs italic text-gray-600">${escapeHTML(just)}</span>` : ''}</div><span class="px-2 py-1 rounded border text-xs font-bold uppercase ${badge}">${status}</span></div>`;
    }
    return `<div ${onclick} class="p-2 border rounded ${cursor} flex flex-col justify-between min-h-[75px] transition ${cor}"><span class="font-bold text-sm">${d}</span><div><span class="text-[10px] uppercase font-semibold">${status}</span>${just ? `<span class="text-[9px] truncate block bg-black/20 px-1 rounded text-white">${escapeHTML(just)}</span>` : ''}</div></div>`;
}

function renderizarViewMes(tId, turma) {
    let ano = calDataAtual.getFullYear(), mes = calDataAtual.getMonth();
    document.getElementById('cal-mes-ano-titulo').innerText = `${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][mes]} de ${ano}`;
    let html = '', pd = new Date(ano, mes, 1).getDay(), td = new Date(ano, mes + 1, 0).getDate();
    for(let i=0; i<pd; i++) html += `<div class="p-2 border rounded bg-gray-50 min-h-[75px]"></div>`;
    let ini = new Date(turma.inicio + 'T00:00:00'), fim = new Date(turma.fim + 'T00:00:00');
    for(let d=1; d<=td; d++) {
        let dt = new Date(ano, mes, d), iso = dt.toISOString().split('T')[0];
        html += gerarBlocoDia(d, iso, dt >= ini && dt <= fim, db.calendario[tId]?.[iso]);
    }
    document.getElementById('grid-dias-calendario').innerHTML = html;
}

function renderizarViewEmpilhado(tId, turma) {
    let ini = new Date(turma.inicio + 'T00:00:00'), fim = new Date(turma.fim + 'T00:00:00'), mAt = new Date(ini.getFullYear(), ini.getMonth(), 1), html = '';
    while(mAt <= new Date(fim.getFullYear(), fim.getMonth(), 1)) {
        let a = mAt.getFullYear(), m = mAt.getMonth(), g = '';
        for(let i=0; i<new Date(a, m, 1).getDay(); i++) g += `<div class="p-2 border rounded bg-gray-50 min-h-[75px]"></div>`;
        for(let d=1; d<=new Date(a, m + 1, 0).getDate(); d++) {
            let dt = new Date(a, m, d); g += gerarBlocoDia(d, dt.toISOString().split('T')[0], dt >= ini && dt <= fim, db.calendario[tId]?.[dt.toISOString().split('T')[0]]);
        }
        html += `<div class="bg-white border rounded-lg shadow-sm mb-4"><h3 class="text-sm font-bold text-purple-900 uppercase p-3 bg-purple-50 border-b text-center">${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][m]} de ${a}</h3><div class="p-3"><div class="grid grid-cols-7 gap-2">${g}</div></div></div>`;
        mAt.setMonth(mAt.getMonth() + 1);
    }
    document.getElementById('empilhado-dias-calendario').innerHTML = html;
}

function renderizarViewListaCompleta(tId, turma) {
    let html = '', c = new Date(turma.inicio + 'T00:00:00'), f = new Date(turma.fim + 'T00:00:00');
    while(c <= f) { html += gerarBlocoDia(c.getDate(), c.toISOString().split('T')[0], true, db.calendario[tId]?.[c.toISOString().split('T')[0]], true); c.setDate(c.getDate() + 1); }
    document.getElementById('lista-dias-calendario').innerHTML = html;
}

function popularDatasMaster() {
    const tId = document.getElementById('master-turma').value; 
    const sel = document.getElementById('master-data'); 
    sel.innerHTML = '<option value="">Selecione data...</option>'; 
    document.getElementById('master-area-alunos').classList.add('hidden');
    if(!tId) return; 
    let dias = Object.keys(db.calendario[tId] || {}).filter(k => k !== '_status' && ['agendada','remarcada'].includes(db.calendario[tId][k].status)).sort();
    dias.forEach(d => sel.innerHTML += `<option value="${d}">${formatData(d)}</option>`);
}

function carregarDadosMaster() {
    const tId = document.getElementById('master-turma').value, d = document.getElementById('master-data').value; 
    if(!tId || !d) return document.getElementById('master-area-alunos').classList.add('hidden');
    renderizarTabelaMaster(); 
    document.getElementById('master-area-alunos').classList.remove('hidden');
}

function renderizarTabelaMaster() {
    const tId = document.getElementById('master-turma').value, d = document.getElementById('master-data').value;
    if(!db.atividades[tId]) db.atividades[tId] = {};
    if(!db.atividades[tId][d]) db.atividades[tId][d] = { colunas: [], notas: {} };
    let cols = db.atividades[tId][d].colunas || [];
    
    let th = `<tr><th class="p-3 border bg-gray-50">Aluno</th><th class="p-3 border text-center">1ªH</th><th class="p-3 border text-center">2ªH</th><th class="p-3 border text-center">3ªH</th><th class="p-3 border text-center">4ªH</th><th class="p-3 border text-center">5ªH</th><th class="p-3 border text-center">6ªH</th>`; 
    cols.forEach(c => th += `<th class="p-3 border text-center text-purple-600">${escapeHTML(c.nome)}</th>`); 
    th += `</tr>`; 
    document.getElementById('thead-master').innerHTML = th;
    
    let aT = db.alunos.filter(a => a.turma_id === tId).sort((a,b) => a.nome.localeCompare(b.nome)); 
    let tb = aT.length===0 ? `<tr><td colspan="8" class="text-center p-6">Nenhum aluno.</td></tr>` : '';
    
    if(!db.frequencias[tId]) db.frequencias[tId] = {};
    if(!db.frequencias[tId][d]) db.frequencias[tId][d] = {};

    aT.forEach(a => {
        let f = db.frequencias[tId][d][a.id] || ['','','','','','']; 
        tb += `<tr><td class="p-2 border font-bold bg-white">${escapeHTML(a.nome)}</td>`;
        for(let i=0; i<6; i++) { 
            let cls = f[i]==='P'?"bg-green-100 text-green-700":(f[i]==='F'?"bg-red-100 text-red-700":"bg-gray-100"); 
            tb += `<td class="border p-1 text-center"><button onclick="mF('${a.id}', ${i})" class="w-full py-1 rounded font-bold transition hover:scale-105 ${cls}">${f[i]||'-'}</button></td>`; 
        }
        cols.forEach(c => {
            let notaVal = db.atividades[tId][d].notas[a.id]?.[c.id] || '';
            tb += `<td class="border p-1"><input type="text" value="${escapeHTML(notaVal)}" onchange="mN('${a.id}', '${c.id}', this.value)" class="w-full text-center p-1 border rounded bg-gray-50 outline-none"></td>`;
        });
        tb += `</tr>`;
    }); 
    document.getElementById('tbody-master').innerHTML = tb;
}

async function mF(aId, idx) {
    const tId = document.getElementById('master-turma').value, d = document.getElementById('master-data').value;
    if(!db.frequencias[tId][d][aId]) db.frequencias[tId][d][aId] = ['','','','','',''];
    let atual = db.frequencias[tId][d][aId][idx], nv = atual===''?'P':(atual==='P'?'F':'');
    db.frequencias[tId][d][aId][idx] = nv;
    if(idx===0) for(let i=1;i<6;i++) db.frequencias[tId][d][aId][i] = nv;
    
    await supabaseClient.from('frequencias').upsert({ turma_id: tId, data: d, aluno_id: aId, horas: db.frequencias[tId][d][aId] }, { onConflict: 'turma_id,data,aluno_id' });
    renderizarTabelaMaster();
}

async function mN(aId, cId, v) {
    const tId = document.getElementById('master-turma').value, d = document.getElementById('master-data').value;
    if(!db.atividades[tId][d].notas[aId]) db.atividades[tId][d].notas[aId] = {};
    db.atividades[tId][d].notas[aId][cId] = v;
    
    await supabaseClient.from('atividades').upsert({ turma_id: tId, data: d, colunas: db.atividades[tId][d].colunas, notas: db.atividades[tId][d].notas }, { onConflict: 'turma_id,data' });
}

function abrirRelatorioAluno(id) {
    let a = db.alunos.find(x => x.id === id), t = db.turmas.find(x => x.id === a.turma_id), fC = calcularFrequenciaAluno(id), nC = calcularNotasAluno(id, a.turma_id);
    document.getElementById('modal-titulo').innerText = "Boletim do Aluno"; 
    let fa = [];
    Object.keys(db.frequencias).forEach(tId => Object.keys(db.frequencias[tId]).forEach(d => { 
        let hr = db.frequencias[tId][d][id]; 
        if(hr && hr.some(v => v !== '')) fa.push({ d, p: hr }); 
    }));
    let tbF = fa.sort((x,y)=>new Date(x.d)-new Date(y.d)).map(x => `<tr class="border-b"><td class="p-2">${formatData(x.d)}</td><td class="p-2 text-center font-bold">${x.p[0]}</td><td class="p-2 text-center font-bold">${x.p[1]}</td><td class="p-2 text-center font-bold">${x.p[2]}</td><td class="p-2 text-center font-bold">${x.p[3]}</td><td class="p-2 text-center font-bold">${x.p[4]}</td><td class="p-2 text-center font-bold">${x.p[5]}</td></tr>`).join('');
    let tbN = nC.historico.map(n => `<tr class="border-b"><td class="p-2">${formatData(n.data)}</td><td class="p-2">${escapeHTML(n.atividade)}</td><td class="p-2 font-bold text-right text-blue-600">${n.nota.toFixed(1)}</td></tr>`).join('');
    
    document.getElementById('modal-conteudo').innerHTML = `
        <h2 class="text-2xl font-bold">${escapeHTML(a.nome)}</h2>
        <p class="mb-4">Turma: ${t?escapeHTML(t.nome):'-'}</p>
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 border p-4 text-center rounded"><span class="text-sm font-bold">Pontuação</span><div class="text-3xl font-black">${nC.total.toFixed(1)}</div></div>
            <div class="bg-purple-50 border p-4 text-center rounded"><span class="text-sm font-bold">Frequência</span><div class="text-3xl font-black">${fC.percent}%</div></div>
            <div class="bg-green-50 border p-4 text-center rounded"><span class="text-sm font-bold">Presenças</span><div class="text-3xl font-black">${fC.pres}h</div></div>
            <div class="bg-red-50 border p-4 text-center rounded"><span class="text-sm font-bold">Faltas</span><div class="text-3xl font-black">${fC.faltas}h</div></div>
        </div>
        <h4 class="font-bold border-b mb-2">Notas</h4>
        <table class="w-full text-sm border mb-6"><thead class="bg-gray-100"><tr><th class="p-2 text-left">Data</th><th class="p-2 text-left">Atividade</th><th class="p-2 text-right">Nota</th></tr></thead><tbody>${tbN||'<tr><td colspan="3" class="text-center p-4">Sem notas</td></tr>'}</tbody></table>
        <h4 class="font-bold border-b mb-2">Diário</h4>
        <table class="w-full text-sm border mb-12"><thead class="bg-gray-100"><tr><th class="p-2 text-left">Data</th><th colspan="6" class="p-2">Horas</th></tr></thead><tbody>${tbF||'<tr><td colspan="7" class="text-center p-4">Sem presenças</td></tr>'}</tbody></table>
        <div class="mt-16 pt-8 flex flex-col items-center justify-center">
            <div class="w-80 border-b border-black mb-2"></div>
            <p class="font-bold text-gray-800">${escapeHTML(a.nome)}</p>
            <p class="text-xs text-gray-500">Assinatura do Aluno</p>
        </div>
    `;
    document.getElementById('modal-container').classList.replace('hidden', 'flex');
}

function abrirRelatorioTurma(id) {
    let t = db.turmas.find(x => x.id === id); 
    document.getElementById('modal-titulo').innerText = "Fecho: " + escapeHTML(t.nome);
    let tb = db.alunos.filter(a => a.turma_id === id).sort((a,b)=>a.nome.localeCompare(b.nome)).map(a => { 
        let fC = calcularFrequenciaAluno(a.id), nC = calcularNotasAluno(a.id, id); 
        return `<tr><td class="p-3 border">${escapeHTML(a.nome)}</td><td class="p-3 border text-center font-bold text-blue-600">${nC.total.toFixed(1)}</td><td class="p-3 border text-center font-bold">${fC.percent}%</td><td class="p-3 border text-center">${fC.pres}h</td><td class="p-3 border text-center text-red-600 font-bold">${fC.faltas}h</td></tr>`; 
    }).join('');
    document.getElementById('modal-conteudo').innerHTML = `<h2 class="text-2xl font-bold mb-6">${escapeHTML(t.nome)}</h2><table class="w-full text-sm border"><thead class="bg-purple-50 text-purple-900"><tr><th class="p-3 border">Aluno</th><th class="p-3 border text-center">Pontos</th><th class="p-3 border text-center">Freq.</th><th class="p-3 border text-center">Presenças</th><th class="p-3 border text-center">Faltas</th></tr></thead><tbody>${tb||'<tr><td colspan="5" class="text-center p-4">Vazio</td></tr>'}</tbody></table>`; 
    document.getElementById('modal-container').classList.replace('hidden', 'flex');
}

function exportarBackupXLSX() {
    if (typeof XLSX === 'undefined') return alert('Biblioteca XLSX não carregada.'); 
    let bk = [];
    Object.keys(db.frequencias).forEach(tId => {
        let turmaObj = db.turmas.find(t => t.id === tId);
        let nomeTurma = turmaObj ? turmaObj.nome : "Desconhecida";
        Object.keys(db.frequencias[tId]).forEach(d => {
            Object.keys(db.frequencias[tId][d]).forEach(aId => {
                let f = db.frequencias[tId][d][aId];
                let alunoObj = db.alunos.find(a => a.id === aId);
                let nomeAluno = alunoObj ? alunoObj.nome : "Desconhecido";
                if(f && f.some(v => v === 'P' || v === 'F')) {
                    bk.push({ "Turma": nomeTurma, "Data": formatData(d), "Aluno": nomeAluno, "1ªH": f[0]||"", "2ªH": f[1]||"", "3ªH": f[2]||"", "4ªH": f[3]||"", "5ªH": f[4]||"", "6ªH": f[5]||"" });
                }
            });
        });
    });
    if(bk.length === 0) return alert('Sem registos para exportar.'); 
    let wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(bk);
    XLSX.utils.book_append_sheet(wb, ws, "Chamadas"); 
    XLSX.writeFile(wb, `Backup_Relacional_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Backup gerado!');
}
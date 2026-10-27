// app.js
let preceptorLogado = null;
let db = { preceptores: [], turmas: [], alunos: [], frequencias: {}, atividades: {}, calendario: {} };
let colunasAtuais = [];

window.onload = async () => {
    let { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        let email = session.user.email;
        let { data: precData } = await supabaseClient.from('preceptores').select('*').eq('login', email).single();
        if (precData) {
            preceptorLogado = precData;
            await carregarDadosApp();
            iniciarInterface();
            iniciarRealtimeApp(); 
        } else {
            mostrarLogin();
        }
    } else {
        mostrarLogin();
    }
    document.getElementById('loading-inicial').classList.add('hidden');
};

function iniciarRealtimeApp() {
    supabaseClient.channel('app_relacional')
        .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
            await carregarDadosApp();
            carregarTurmasPreceptor();
            let tId = document.getElementById('select-turma').value;
            let d = document.getElementById('data-aula').value;
            if (tId && d) carregarDadosTurma();
        })
        .subscribe();
}

async function carregarDadosApp() {
    const [pRes, tRes, aRes, fRes, atRes, cRes] = await Promise.all([
        supabaseClient.from('preceptores').select('*'),
        supabaseClient.from('turmas').select('*'),
        supabaseClient.from('alunos').select('*'),
        supabaseClient.from('frequencias').select('*'),
        supabaseClient.from('atividades').select('*'),
        supabaseClient.from('calendario').select('*')
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
}

function mostrarLogin() { 
    document.getElementById('screen-login').classList.replace('hidden', 'flex'); 
    document.getElementById('screen-app').classList.replace('flex', 'hidden'); 
}

async function fazerLogin() {
    let email = document.getElementById('login-user').value.trim(); 
    let p = document.getElementById('login-pass').value.trim();
    let btn = document.getElementById('btn-login');
    btn.disabled = true; btn.innerText = "A verificar...";
    
    let { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: p });
    
    if (error) {
        showNotification('Credenciais inválidas!', true);
        btn.disabled = false; btn.innerText = "Entrar";
        return;
    }

    let { data: precData } = await supabaseClient.from('preceptores').select('*').eq('login', email).single();
    if (precData) { 
        preceptorLogado = precData; 
        await carregarDadosApp();
        iniciarInterface(); 
        iniciarRealtimeApp(); 
    } else { 
        showNotification('Utilizador não registado como preceptor.', true); 
        await supabaseClient.auth.signOut();
    }
    btn.disabled = false; btn.innerText = "Entrar";
}

async function logout() { 
    await supabaseClient.auth.signOut();
    preceptorLogado = null; 
    mostrarLogin(); 
}

function iniciarInterface() {
    document.getElementById('user-name').innerText = `Preceptor(a): ${escapeHTML(preceptorLogado.nome)}`;
    document.getElementById('screen-login').classList.replace('flex', 'hidden');
    document.getElementById('screen-app').classList.replace('hidden', 'flex');
    carregarTurmasPreceptor();
}

function switchAppTab(tab) {
    document.getElementById('app-tab-gestao').classList.replace('block', 'hidden');
    document.getElementById('app-tab-galeria').classList.replace('block', 'hidden');
    document.getElementById(`app-tab-${tab}`).classList.replace('hidden', 'block');
    document.getElementById('tab-btn-gestao').className = "flex-1 py-3 font-semibold text-gray-500 transition";
    document.getElementById('tab-btn-galeria').className = "flex-1 py-3 font-semibold text-gray-500 transition";
    document.getElementById(`tab-btn-${tab}`).className = "flex-1 py-3 text-purple-700 border-b-2 border-purple-700 font-bold transition";
}

function carregarTurmasPreceptor() {
    let minhas = db.turmas.filter(t => t.preceptor_id === preceptorLogado.id && t.status !== 'finalizada');
    let selT = document.getElementById('select-turma'), selF = document.getElementById('foto-turma');
    let tIdAtual = selT.value;
    
    let opts = '<option value="">Selecione a turma...</option>';
    minhas.forEach(t => opts += `<option value="${t.id}">${escapeHTML(t.nome)}</option>`);
    
    selT.innerHTML = opts; 
    selF.innerHTML = opts;
    
    if (tIdAtual && minhas.find(t => t.id === tIdAtual)) {
        selT.value = tIdAtual;
        selF.value = tIdAtual;
    }
}

function popularDatas() {
    let tId = document.getElementById('select-turma').value, selD = document.getElementById('data-aula');
    let dAtual = selD.value;
    
    selD.innerHTML = '<option value="">Selecione a data...</option>';
    if (!tId) return;
    let cal = db.calendario[tId] || {}, dias = [];
    Object.keys(cal).forEach(k => { if(k !== '_status' && ['agendada','remarcada'].includes(cal[k].status)) dias.push(k); });
    dias.sort().forEach(d => {
        let p = d.split('-');
        selD.innerHTML += `<option value="${d}">${p[2]}/${p[1]}/${p[0]}</option>`;
    });
    
    if (dAtual && dias.includes(dAtual)) selD.value = dAtual;
    carregarDadosTurma();
}

function carregarDadosTurma() {
    let tId = document.getElementById('select-turma').value, d = document.getElementById('data-aula').value, area = document.getElementById('area-alunos');
    if (!tId || !d) { area.classList.add('hidden'); return; }
    if (!db.frequencias[tId]) db.frequencias[tId] = {};
    if (!db.frequencias[tId][d]) db.frequencias[tId][d] = {};
    if (!db.atividades[tId]) db.atividades[tId] = {};
    if (!db.atividades[tId][d]) db.atividades[tId][d] = { colunas: [], notas: {} };
    colunasAtuais = db.atividades[tId][d].colunas || [];
    renderizarTabelaApp();
    area.classList.remove('hidden');
}

function renderizarTabelaApp() {
    let tId = document.getElementById('select-turma').value, d = document.getElementById('data-aula').value;
    let alunosT = db.alunos.filter(a => a.turma_id === tId).sort((a,b)=>a.nome.localeCompare(b.nome));
    let freq = db.frequencias[tId][d], notas = db.atividades[tId][d].notas;

    let th = `<tr><th class="p-3 border bg-gray-50">Aluno</th>`;
    for(let i=1; i<=6; i++) th += `<th class="p-3 border text-center text-xs">${i}ªH</th>`;
    colunasAtuais.forEach(c => th += `<th class="p-3 border text-center text-orange-600 text-xs">${escapeHTML(c.nome)}</th>`);
    th += `</tr>`;
    document.getElementById('thead-alunos').innerHTML = th;

    let tb = '';
    alunosT.forEach(a => {
        let f = freq[a.id] || ['','','','','',''];
        tb += `<tr><td class="p-2 border font-bold text-sm bg-white">${escapeHTML(a.nome)}</td>`;
        for (let i=0; i<6; i++) {
            let cls = f[i]==='P' ? "bg-green-100 text-green-700" : (f[i]==='F' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400");
            tb += `<td class="border p-1 text-center"><button onclick="togglePresencaApp('${a.id}', ${i})" class="w-full py-2 rounded font-bold border ${cls}">${f[i]||'-'}</button></td>`;
        }
        colunasAtuais.forEach(c => {
            let val = notas[a.id]?.[c.id] || '';
            tb += `<td class="border p-1"><input type="text" value="${escapeHTML(val)}" onchange="atualizarNotaApp('${a.id}', '${c.id}', this.value)" class="w-full text-center p-2 border rounded font-bold outline-none bg-gray-50"></td>`;
        });
        tb += `</tr>`;
    });
    document.getElementById('tbody-alunos').innerHTML = tb;
}

async function togglePresencaApp(aId, idx) {
    let tId = document.getElementById('select-turma').value, d = document.getElementById('data-aula').value;
    if (!db.frequencias[tId][d][aId]) db.frequencias[tId][d][aId] = ['','','','','',''];
    let atual = db.frequencias[tId][d][aId][idx], nv = atual==='' ? 'P' : (atual==='P' ? 'F' : '');
    db.frequencias[tId][d][aId][idx] = nv;
    if (idx === 0) for(let i=1; i<6; i++) db.frequencias[tId][d][aId][i] = nv;
    
    renderizarTabelaApp();
    await supabaseClient.from('frequencias').upsert({ turma_id: tId, data: d, aluno_id: aId, horas: db.frequencias[tId][d][aId] }, { onConflict: 'turma_id,data,aluno_id' });
}

async function atualizarNotaApp(aId, cId, val) {
    let tId = document.getElementById('select-turma').value, d = document.getElementById('data-aula').value;
    if (!db.atividades[tId][d].notas[aId]) db.atividades[tId][d].notas[aId] = {};
    db.atividades[tId][d].notas[aId][cId] = val;
    
    await supabaseClient.from('atividades').upsert({ turma_id: tId, data: d, colunas: db.atividades[tId][d].colunas, notas: db.atividades[tId][d].notas }, { onConflict: 'turma_id,data' });
}

function abrirModalAtividade() { document.getElementById('modal-atividade').classList.replace('hidden', 'flex'); document.getElementById('nome-atividade').value = ''; }
function fecharModalAtividade() { document.getElementById('modal-atividade').classList.replace('flex', 'hidden'); }

async function adicionarColunaAtividade() {
    let nome = document.getElementById('nome-atividade').value.trim();
    if (!nome) return;
    let tId = document.getElementById('select-turma').value, d = document.getElementById('data-aula').value;
    db.atividades[tId][d].colunas.push({ id: 'col_' + Date.now(), nome });
    colunasAtuais = db.atividades[tId][d].colunas;
    
    fecharModalAtividade();
    renderizarTabelaApp();
    await supabaseClient.from('atividades').upsert({ turma_id: tId, data: d, colunas: colunasAtuais, notas: db.atividades[tId][d].notas }, { onConflict: 'turma_id,data' });
    showNotification('Coluna criada!');
}

async function salvarFotoStorage() {
    let fileInput = document.getElementById('foto-file'), file = fileInput.files[0];
    let desc = document.getElementById('foto-desc').value, tId = document.getElementById('foto-turma').value;
    if (!file || !desc) return alert('Selecione a foto e preencha a descrição!');

    let btn = document.getElementById('btn-envia-foto');
    btn.innerText = "A enviar para o Storage..."; btn.disabled = true;

    let fileName = `${Date.now()}_${Math.random().toString().slice(2,6)}.jpg`;
    
    let { data, error } = await supabaseClient.storage.from('fotos-estagio').upload(fileName, file);
    if (error) {
        btn.innerText = "Enviar para o Storage"; btn.disabled = false;
        return alert('Erro no upload: ' + error.message);
    }

    let { data: pubData } = supabaseClient.storage.from('fotos-estagio').getPublicUrl(fileName);
    let publicUrl = pubData.publicUrl;

    let novaFoto = { id: 'foto_' + Date.now(), turma_id: tId || null, preceptor_id: preceptorLogado.id, data: new Date().toISOString().split('T')[0], imagem_url: publicUrl, descricao: desc };

    let { error: errIns } = await supabaseClient.from('galeria').insert([novaFoto]);
    btn.innerText = "Enviar para o Storage"; btn.disabled = false;

    if (errIns) return alert('Erro ao salvar registo: ' + errIns.message);

    document.getElementById('foto-desc').value = '';
    fileInput.value = '';
    showNotification('Foto enviada com sucesso!');
}
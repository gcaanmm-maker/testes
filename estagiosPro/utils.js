// utils.js

// Sanitização contra XSS
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}

// Formatação de Datas
function formatData(d) {
    if (!d) return ''; 
    let p = d.split('-'); 
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; 
}

// Sistema unificado de Notificações
function showNotification(msg, isError = false) {
    const notif = document.getElementById('notification');
    notif.innerHTML = `
        <div class="${isError ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded shadow-lg flex items-center gap-2 font-bold">
            <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
            <span>${msg}</span>
        </div>
    `;
    notif.classList.remove('translate-x-full');
    setTimeout(() => notif.classList.add('translate-x-full'), 3000);
}
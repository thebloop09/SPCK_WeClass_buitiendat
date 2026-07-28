const SUPABASE_URL = 'https://wxeifjtogdqxebubkviv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZWlmanRvZ2RxeGVidWJrdml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTQ2NTAsImV4cCI6MjEwMDc5MDY1MH0.l2W0EbCKrCUPS7EjY0rCz1cPCzWy344SaBk4jATTA7I';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentClassId = null;
let currentStudents = [];

// --- THEME ---
function updateThemeUI(theme) {
    const el = document.getElementById('themeText');
    if (el) el.innerText = theme === 'light' ? 'Chế độ Tối 🌙' : 'Chế độ Sáng ☀️';
}

window.toggleTheme = function() {
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeUI(theme);
};

// --- DATA ---
window.loadClasses = async function() {
    if (!window.location.pathname.includes('class.html')) return;
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const { data: classes } = await _supabase.from('classes').select('*').eq('user_id', user.id);
    const list = document.getElementById('class-list');
    if (!list) return;
    list.innerHTML = classes?.length ? '' : '<p style="grid-column:1/-1; text-align:center; color:var(--text-sub)">Chưa có lớp nào.</p>';

    classes?.forEach(cls => {
        list.innerHTML += `
            <div class="class-item">
                <span class="class-icon">🎨</span>
                <h4>${cls.name}</h4>
                <div class="class-actions">
                    <button onclick="viewClass('${cls.id}', '${cls.name}')">Vào học</button>
                    <button class="danger" onclick="deleteClass('${cls.id}')">Xóa</button>
                </div>
            </div>`;
    });
};

window.viewClass = (id, name) => {
    currentClassId = id;
    document.getElementById('class-section').classList.add('hidden');
    document.getElementById('student-section').classList.remove('hidden');
    document.getElementById('current-class-title').innerText = name;
    loadStudents();
};

window.showClasses = () => {
    document.getElementById('class-section').classList.remove('hidden');
    document.getElementById('student-section').classList.add('hidden');
};

window.deleteClass = async (id) => {
    if(confirm("Xóa lớp?")) { await _supabase.from('classes').delete().eq('id', id); loadClasses(); }
};

async function loadStudents() {
    const { data: st } = await _supabase.from('students').select('*').eq('class_id', currentClassId);
    const list = document.getElementById('student-list');
    list.innerHTML = '';
    st?.forEach(s => {
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:12px; background:var(--input-bg); border-radius:15px; margin-bottom:8px; width:100%">
                <span><b>#${s.student_number}</b> ${s.name}</span>
                <span style="color:#ef4444; cursor:pointer" onclick="deleteStudent('${s.id}')">✕</span>
            </div>`;
    });
    currentStudents = st || [];
}

window.deleteStudent = async (id) => { await _supabase.from('students').delete().eq('id', id); loadStudents(); };

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    _supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            const user = session.user;
            if (document.getElementById('userEmailDisplay')) document.getElementById('userEmailDisplay').innerText = user.email;
            const btn = document.getElementById('avatarBtn');
            if (btn) {
                btn.innerText = user.email[0].toUpperCase();
                btn.onclick = (e) => { e.stopPropagation(); document.getElementById('userDropdown').classList.toggle('show'); };
            }
            loadClasses();
        } else if (window.location.pathname.includes('class.html')) {
            window.location.href = 'login.html';
        }
    });

    window.onclick = () => document.getElementById('userDropdown')?.classList.remove('show');

    // Events
    const clickAction = (id, func) => { const el = document.getElementById(id); if(el) el.onclick = func; };

    clickAction('btnLogin', async () => {
        const { error } = await _supabase.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
        if (error) alert(error.message); else window.location.href = 'class.html';
    });

    clickAction('btnRegister', async () => {
        const { error } = await _supabase.auth.signUp({ email: document.getElementById('email').value, password: document.getElementById('password').value });
        if (error) alert(error.message); else alert("Đăng ký thành công!");
    });

    clickAction('btnLogout', async () => { await _supabase.auth.signOut(); window.location.href = 'login.html'; });

    clickAction('btnAddClass', async () => {
        const name = document.getElementById('className').value;
        const { data: { user } } = await _supabase.auth.getUser();
        await _supabase.from('classes').insert([{ name, user_id: user.id }]);
        document.getElementById('className').value = ''; loadClasses();
    });

    clickAction('btnAddStudent', async () => {
        await _supabase.from('students').insert([{ name: document.getElementById('stName').value, student_number: document.getElementById('stNumber').value, class_id: currentClassId }]);
        document.getElementById('stName').value = ''; document.getElementById('stNumber').value = ''; loadStudents();
    });

    clickAction('btnRandom', () => {
        if (!currentStudents.length) return alert('Lớp trống');
        const s = currentStudents[Math.floor(Math.random() * currentStudents.length)];
        document.getElementById('random-result').innerHTML = `<small style="font-weight:400; color:var(--text-sub)">May mắn là:</small><br>${s.name}`;
    });
});
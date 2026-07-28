const SUPABASE_URL = 'https://wxeifjtogdqxebubkviv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZWlmanRvZ2RxeGVidWJrdml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTQ2NTAsImV4cCI6MjEwMDc5MDY1MH0.l2W0EbCKrCUPS7EjY0rCz1cPCzWy344SaBk4jATTA7I';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentClassId = null;

// --- THEME MANAGEMENT ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = savedTheme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-toggle').innerHTML = newTheme === 'light' ? '🌙' : '☀️';
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    if (document.getElementById('theme-toggle')) {
        document.getElementById('theme-toggle').onclick = toggleTheme;
    }
});

// --- AUTHENTICATION ---
if (document.getElementById('btnRegister')) {
    document.getElementById('btnRegister').onclick = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await _supabase.auth.signUp({ email, password });
        if (error) alert("Lỗi: " + error.message);
        else alert("Đăng ký thành công! Hãy đăng nhập.");
    };
}

if (document.getElementById('btnLogin')) {
    document.getElementById('btnLogin').onclick = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) alert("Lỗi: " + error.message); 
        else window.location.href = 'class.html';
    };
}

if (document.getElementById('btnLogout')) {
    document.getElementById('btnLogout').onclick = async () => {
        await _supabase.auth.signOut();
        window.location.href = 'login.html';
    };
}

// --- CLASS MANAGEMENT ---
async function loadClasses() {
    if (!window.location.pathname.includes('class.html')) return;
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    const { data: classes } = await _supabase.from('classes').select('*').eq('user_id', user.id);
    const listDiv = document.getElementById('class-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (classes) {
        classes.forEach(cls => {
            listDiv.innerHTML += `
                <div class="class-item">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                    <h4>${cls.name}</h4>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 1.5rem;">
                        <button style="width: auto;" onclick="viewClass('${cls.id}', '${cls.name}')">Vào lớp</button>
                        <button style="width: auto;" class="danger" onclick="deleteClass('${cls.id}')">Xóa</button>
                    </div>
                </div>
            `;
        });
    }
}

if (document.getElementById('btnAddClass')) {
    document.getElementById('btnAddClass').onclick = async () => {
        const name = document.getElementById('className').value;
        if (!name) return alert("Vui lòng nhập tên lớp");
        const { data: { user } } = await _supabase.auth.getUser();
        await _supabase.from('classes').insert([{ name, user_id: user.id }]);
        document.getElementById('className').value = '';
        loadClasses();
    };
}

// --- STUDENT MANAGEMENT ---
async function loadStudents() {
    const { data: students } = await _supabase.from('students').select('*').eq('class_id', currentClassId);
    const listDiv = document.getElementById('student-list');
    listDiv.innerHTML = '';
    if (students) {
        students.forEach(st => {
            listDiv.innerHTML += `
                <div class="student-item">
                    <span><strong>[${st.student_number}]</strong> ${st.name}</span>
                    <button class="danger" style="width: auto; padding: 5px 10px;" onclick="deleteStudent('${st.id}')">Xóa</button>
                </div>
            `;
        });
        window.currentStudents = students;
    }
}

window.viewClass = async function(id, name) {
    currentClassId = id;
    document.getElementById('class-section').classList.add('hidden');
    document.getElementById('student-section').classList.remove('hidden');
    document.getElementById('current-class-title').innerText = 'Lớp: ' + name;
    loadStudents();
}

window.showClasses = function() {
    document.getElementById('class-section').classList.remove('hidden');
    document.getElementById('student-section').classList.add('hidden');
}

window.deleteClass = async function(id) {
    if (confirm('Xóa lớp này?')) {
        await _supabase.from('classes').delete().eq('id', id);
        loadClasses();
    }
}

window.deleteStudent = async function(id) {
    await _supabase.from('students').delete().eq('id', id);
    loadStudents();
}

if (document.getElementById('btnAddStudent')) {
    document.getElementById('btnAddStudent').onclick = async () => {
        const name = document.getElementById('stName').value;
        const num = document.getElementById('stNumber').value;
        await _supabase.from('students').insert([{ name, student_number: num, class_id: currentClassId }]);
        document.getElementById('stName').value = ''; document.getElementById('stNumber').value = '';
        loadStudents();
    };
}

if (document.getElementById('btnRandom')) {
    document.getElementById('btnRandom').onclick = () => {
        if (!window.currentStudents || window.currentStudents.length === 0) return alert('Lớp trống');
        const st = window.currentStudents[Math.floor(Math.random() * window.currentStudents.length)];
        document.getElementById('random-result').innerHTML = `🎉 <br> [${st.student_number}] ${st.name}`;
    };
}

loadClasses();
const SUPABASE_URL = 'https://wxeifjtogdqxebubkviv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZWlmanRvZ2RxeGVidWJrdml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTQ2NTAsImV4cCI6MjEwMDc5MDY1MH0.l2W0EbCKrCUPS7EjY0rCz1cPCzWy344SaBk4jATTA7I';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- THEME & DROPDOWN LOGIC ---
document.addEventListener('DOMContentLoaded', async () => {
    // Khởi tạo Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    // Dropdown Avatar
    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) {
        avatarBtn.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.toggle('show');
        };
    }
    window.onclick = () => document.getElementById('userDropdown')?.classList.remove('show');

    // Hiển thị Email nếu đã đăng nhập
    const { data: { user } } = await _supabase.auth.getUser();
    if (user && document.getElementById('userEmailDisplay')) {
        document.getElementById('userEmailDisplay').innerText = user.email;
        document.getElementById('avatarBtn').innerText = user.email[0].toUpperCase();
    }
});

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
    const themeText = document.getElementById('themeText');
    if (themeText) themeText.innerText = theme === 'light' ? 'Chế độ Tối 🌙' : 'Chế độ Sáng ☀️';
}

// --- XỬ LÝ ĐĂNG KÝ (FIXED) ---
if (document.getElementById('btnRegister')) {
    document.getElementById('btnRegister').onclick = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) return alert("Vui lòng nhập đủ Email và Mật khẩu");

        const { data, error } = await _supabase.auth.signUp({ 
            email: email, 
            password: password 
        });

        if (error) {
            alert("Lỗi đăng ký: " + error.message);
            console.error(error);
        } else {
            alert("Đăng ký thành công! QUAN TRỌNG: Hãy kiểm tra hộp thư đến của Email này và nhấn xác nhận mới có thể đăng nhập.");
            window.location.href = 'login.html';
        }
    };
}

// --- XỬ LÝ ĐĂNG NHẬP ---
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

// --- QUẢN LÝ LỚP HỌC ---
async function loadClasses() {
    if (!window.location.pathname.includes('class.html')) return;
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const { data: classes } = await _supabase.from('classes').select('*').eq('user_id', user.id);
    const listDiv = document.getElementById('class-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (classes) {
        classes.forEach(cls => {
            listDiv.innerHTML += `
                <div class="class-item shadow">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎨</div>
                    <h4 style="margin-bottom: 1.5rem;">${cls.name}</h4>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="viewClass('${cls.id}', '${cls.name}')">Vào học</button>
                        <button class="danger" onclick="deleteClass('${cls.id}')" style="width:auto">Xóa</button>
                    </div>
                </div>
            `;
        });
    }
}

if (document.getElementById('btnAddClass')) {
    document.getElementById('btnAddClass').onclick = async () => {
        const name = document.getElementById('className').value;
        if (!name) return alert("Nhập tên lớp");
        const { data: { user } } = await _supabase.auth.getUser();
        await _supabase.from('classes').insert([{ name, user_id: user.id }]);
        document.getElementById('className').value = '';
        loadClasses();
    };
}

window.viewClass = async function(id, name) {
    currentClassId = id;
    document.getElementById('class-section').classList.add('hidden');
    document.getElementById('student-section').classList.remove('hidden');
    document.getElementById('current-class-title').innerText = name;
    loadStudents();
}

window.showClasses = function() {
    document.getElementById('class-section').classList.remove('hidden');
    document.getElementById('student-section').classList.add('hidden');
}

window.deleteClass = async function(id) {
    if(confirm("Xóa lớp này?")) {
        await _supabase.from('classes').delete().eq('id', id);
        loadClasses();
    }
}

async function loadStudents() {
    const { data: students } = await _supabase.from('students').select('*').eq('class_id', currentClassId);
    const listDiv = document.getElementById('student-list');
    listDiv.innerHTML = '';
    if (students) {
        students.forEach(st => {
            listDiv.innerHTML += `
                <div style="display:flex; justify-content:space-between; width:100%; padding:12px; background:var(--input-bg); border-radius:15px; margin-bottom:8px;">
                    <span><b>#${st.student_number}</b> ${st.name}</span>
                    <span style="color:red; cursor:pointer" onclick="deleteStudent('${st.id}')">✕</span>
                </div>
            `;
        });
        window.currentStudents = students;
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
        document.getElementById('random-result').innerHTML = `<small>Người may mắn:</small><br>${st.name}`;
    };
}

loadClasses();
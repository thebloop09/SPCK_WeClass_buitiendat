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
    const { data: st, error } = await _supabase
        .from('students')
        .select('*')
        .eq('class_id', currentClassId);

    if (error) {
        console.error('Lỗi lấy danh sách học sinh:', error);
        return;
    }

    const list = document.getElementById('student-list');
    if (!list) return;
    list.innerHTML = '';
    
    // SỬA LỖI SẮP XẾP TẠI ĐÂY: Ép kiểu student_number về dạng Số nguyên để so sánh chính xác (1 < 2 < 10 < 23)
    currentStudents = (st || []).sort((a, b) => {
        const numA = parseInt(a.student_number, 10) || 0;
        const numB = parseInt(b.student_number, 10) || 0;
        return numA - numB;
    });

    currentStudents.forEach(s => {
        const points = Number(s.points) || 0;
        const pointClass = points > 0 ? 'pos' : points < 0 ? 'neg' : '';
        const pointText = points > 0 ? `+${points}` : `${points}`;

        list.innerHTML += `
            <div class="student-item" onclick="openPointModal('${s.id}')">
                <div class="student-info">
                    <b>#${s.student_number}</b> ${s.name}
                </div>
                <span class="student-score ${pointClass}">${pointText} điểm</span>
                <span class="delete-btn" onclick="deleteStudentEvent(event, '${s.id}')">✕</span>
            </div>`;
    });
}

window.deleteStudentEvent = async (event, id) => {
    event.stopPropagation();
    if (confirm("Bạn có chắc muốn xóa học sinh này?")) {
        await _supabase.from('students').delete().eq('id', id);
        loadStudents();
    }
};

window.deleteStudent = async (id) => { 
    await _supabase.from('students').delete().eq('id', id); 
    loadStudents(); 
};

// --- MODAL CỘNG/TRỪ ĐIỂM ---
window.openPointModal = (studentId) => {
    const student = currentStudents.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const points = Number(student.points) || 0;
    const pointClass = points > 0 ? 'pos' : points < 0 ? 'neg' : '';
    const pointText = points > 0 ? `+${points}` : `${points}`;

    const existing = document.getElementById('pointModalOverlay');
    if (existing) existing.remove();

    const modalHTML = `
        <div id="pointModalOverlay" class="modal-overlay" onclick="closePointModal(event)">
            <div class="point-modal-card" onclick="event.stopPropagation()">
                <button class="close-modal-btn" onclick="closePointModal()">✕</button>
                <div class="modal-left">
                    <div class="st-number">#${student.student_number}</div>
                    <div class="st-name">${student.name}</div>
                    <div class="st-points ${pointClass}">Điểm hiện tại: <b>${pointText}</b></div>
                </div>
                <div class="modal-right">
                    <button class="btn-point btn-sub" onclick="promptPointUpdate('${student.id}', -1)">-</button>
                    <button class="btn-point btn-add" onclick="promptPointUpdate('${student.id}', 1)">+</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closePointModal = (e) => {
    if (!e || e.target.id === 'pointModalOverlay' || e.target.classList.contains('close-modal-btn')) {
        const modal = document.getElementById('pointModalOverlay');
        if (modal) modal.remove();
    }
};

window.promptPointUpdate = async (studentId, type) => {
    const actionText = type === 1 ? 'CỘNG' : 'TRỪ';
    const input = prompt(`Nhập số điểm muốn ${actionText}:`);
    
    if (input === null || input.trim() === '') return;

    const amount = parseInt(input, 10);
    if (isNaN(amount) || amount <= 0) {
        alert('Vui lòng nhập số nguyên dương hợp lệ!');
        return;
    }

    const student = currentStudents.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const currentPoints = Number(student.points) || 0;
    const newPoints = type === 1 ? currentPoints + amount : currentPoints - amount;

    const { error } = await _supabase
        .from('students')
        .update({ points: newPoints })
        .eq('id', studentId);

    if (error) {
        alert('Lỗi cập nhật điểm!\n\nHướng dẫn tạo cột points:\nVào Supabase -> Table Editor -> Bảng "students" -> Thêm cột tên "points", kiểu dữ liệu "int8", giá trị mặc định là 0.');
    } else {
        closePointModal();
        loadStudents();
    }
};

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
        if (!name) return alert('Vui lòng nhập tên lớp');
        const { data: { user } } = await _supabase.auth.getUser();
        await _supabase.from('classes').insert([{ name, user_id: user.id }]);
        document.getElementById('className').value = ''; loadClasses();
    });

    clickAction('btnAddStudent', async () => {
        const nameInput = document.getElementById('stName');
        const numberInput = document.getElementById('stNumber');
        const name = nameInput.value.trim();
        const rawNumber = numberInput.value.trim();

        if (!name || !rawNumber) {
            alert('Vui lòng nhập đầy đủ Tên học sinh và Số thứ tự (STT)!');
            return;
        }

        if (!currentClassId) {
            alert('Không tìm thấy ID lớp học hiện tại!');
            return;
        }

        // Chuyển STT sang số nguyên
        const sttNumber = parseInt(rawNumber, 10);
        const numberToSave = isNaN(sttNumber) ? rawNumber : sttNumber;

        // Thử chèn có kèm cột points
        let { error } = await _supabase.from('students').insert([{ 
            name: name, 
            student_number: numberToSave, 
            class_id: currentClassId,
            points: 0 
        }]);

        // Nếu bảng Supabase chưa có cột points, thử lại mà không gửi cột points
        if (error && error.message.includes('points')) {
            const retry = await _supabase.from('students').insert([{ 
                name: name, 
                student_number: numberToSave, 
                class_id: currentClassId 
            }]);
            error = retry.error;
        }

        if (error) {
            alert('Lỗi thêm học sinh: ' + error.message);
        } else {
            nameInput.value = ''; 
            numberInput.value = ''; 
            loadStudents();
        }
    });

    clickAction('btnRandom', () => {
        if (!currentStudents.length) return alert('Lớp trống');
        const s = currentStudents[Math.floor(Math.random() * currentStudents.length)];
        document.getElementById('random-result').innerHTML = `<small style="font-weight:400; color:var(--text-sub)">May mắn là:</small><br>${s.name}`;
    });
});
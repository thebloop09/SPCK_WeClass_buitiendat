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

// --- DATA CLASS ---
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

    if (error) return console.error(error);

    const list = document.getElementById('student-list');
    if (!list) return;
    list.innerHTML = '';
    
    currentStudents = (st || []).sort((a, b) => (parseInt(a.student_number, 10) || 0) - (parseInt(b.student_number, 10) || 0));

    currentStudents.forEach(s => {
        const points = Number(s.points) || 0;
        const pointClass = points > 0 ? 'pos' : points < 0 ? 'neg' : '';
        const pointText = points > 0 ? `+${points}` : `${points}`;

        list.innerHTML += `
            <div class="student-item" onclick="openPointModal('${s.id}')">
                <div class="student-info"><b>#${s.student_number}</b> ${s.name}</div>
                <span class="student-score ${pointClass}">${pointText} điểm</span>
                <span class="delete-btn" onclick="deleteStudentEvent(event, '${s.id}')">✕</span>
            </div>`;
    });
}

window.deleteStudentEvent = async (event, id) => {
    event.stopPropagation();
    if (confirm("Xóa học sinh này?")) { await _supabase.from('students').delete().eq('id', id); loadStudents(); }
};

// --- MODAL CỘNG TRỪ ĐIỂM ---
window.openPointModal = (studentId) => {
    const student = currentStudents.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const points = Number(student.points) || 0;
    const pointClass = points > 0 ? 'pos' : points < 0 ? 'neg' : '';
    const pointText = points > 0 ? `+${points}` : `${points}`;

    document.getElementById('pointModalOverlay')?.remove();

    const modalHTML = `
        <div id="pointModalOverlay" class="modal-overlay" onclick="closePointModal(event)">
            <div class="point-modal-card" onclick="event.stopPropagation()">
                <button class="close-modal-btn" onclick="closePointModal()">✕</button>
                <div class="modal-left">
                    <div class="st-number">#${student.student_number}</div>
                    <div class="st-name">${student.name}</div>
                    <div class="st-points ${pointClass}">Điểm: <b>${pointText}</b></div>
                </div>
                <div class="modal-right">
                    <button class="btn-point btn-sub" onclick="promptPointUpdate('${student.id}', -1)">-</button>
                    <button class="btn-point btn-add" onclick="promptPointUpdate('${student.id}', 1)">+</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closePointModal = (e) => {
    if (!e || e.target.id === 'pointModalOverlay' || e.target.classList.contains('close-modal-btn')) {
        document.getElementById('pointModalOverlay')?.remove();
    }
};

window.promptPointUpdate = async (studentId, type) => {
    const input = prompt(`Nhập số điểm muốn ${type === 1 ? 'CỘNG' : 'TRỪ'}:`);
    if (!input || isNaN(parseInt(input, 10))) return;

    const amount = parseInt(input, 10);
    const student = currentStudents.find(s => String(s.id) === String(studentId));
    const newPoints = (Number(student.points) || 0) + (type === 1 ? amount : -amount);

    await _supabase.from('students').update({ points: newPoints }).eq('id', studentId);
    closePointModal();
    loadStudents();
};

// --- PHẦN XỬ LÝ THỜI KHÓA BIỂU (TKB) ---
function renderEmptyTables() {
    const schoolTbody = document.querySelector('#table-school tbody');
    const extraTbody = document.querySelector('#table-extra tbody');
    if (!schoolTbody || !extraTbody) return;

    schoolTbody.innerHTML = '';
    for (let slot = 1; slot <= 5; slot++) {
        let row = `<tr><td class="slot-label">Tiết ${slot}</td>`;
        for (let day = 2; day <= 7; day++) {
            row += `<td><input type="text" id="sch_${day}_${slot}" placeholder="Môn học..."></td>`;
        }
        row += `</tr>`;
        schoolTbody.innerHTML += row;
    }

    extraTbody.innerHTML = '';
    for (let slot = 1; slot <= 2; slot++) {
        let row = `<tr><td class="slot-label">Ca ${slot}</td>`;
        for (let day = 2; day <= 7; day++) {
            row += `<td>
                <input type="text" class="time-input" id="ext_time_${day}_${slot}" placeholder="Giờ (vd: 17h-19h)">
                <input type="text" id="ext_sub_${day}_${slot}" placeholder="Môn / Lớp...">
            </td>`;
        }
        row += `</tr>`;
        extraTbody.innerHTML += row;
    }
}

async function loadSchedule() {
    if (!window.location.pathname.includes('tkb.html')) return;
    renderEmptyTables();

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const { data: items } = await _supabase.from('schedule').select('*').eq('user_id', user.id);
    if (!items) return;

    items.forEach(item => {
        if (item.type === 'school') {
            const el = document.getElementById(`sch_${item.day}_${item.slot}`);
            if (el) el.value = item.subject || '';
        } else if (item.type === 'extra') {
            const elTime = document.getElementById(`ext_time_${item.day}_${item.slot}`);
            const elSub = document.getElementById(`ext_sub_${item.day}_${item.slot}`);
            if (elTime) elTime.value = item.time_val || '';
            if (elSub) elSub.value = item.subject || '';
        }
    });
}

async function saveSchedule(type) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return alert("Vui lòng đăng nhập!");

    await _supabase.from('schedule').delete().eq('user_id', user.id).eq('type', type);

    const payload = [];
    const maxSlot = type === 'school' ? 5 : 2;

    for (let slot = 1; slot <= maxSlot; slot++) {
        for (let day = 2; day <= 7; day++) {
            if (type === 'school') {
                const sub = document.getElementById(`sch_${day}_${slot}`)?.value.trim();
                if (sub) payload.push({ user_id: user.id, type: 'school', day, slot, subject: sub });
            } else {
                const timeVal = document.getElementById(`ext_time_${day}_${slot}`)?.value.trim();
                const sub = document.getElementById(`ext_sub_${day}_${slot}`)?.value.trim();
                if (timeVal || sub) payload.push({ user_id: user.id, type: 'extra', day, slot, time_val: timeVal, subject: sub });
            }
        }
    }

    if (payload.length > 0) {
        const { error } = await _supabase.from('schedule').insert(payload);
        if (error) alert("Lỗi khi lưu: " + error.message);
        else alert("Lưu Thời Khóa Biểu thành công! ✨");
    } else {
        alert("Đã xóa trống lịch biểu!");
    }
}

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
            loadSchedule();
        } else if (window.location.pathname.includes('class.html') || window.location.pathname.includes('tkb.html')) {
            window.location.href = 'login.html';
        }
    });

    window.onclick = () => document.getElementById('userDropdown')?.classList.remove('show');

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
        if (!name) return alert('Nhập tên lớp');
        const { data: { user } } = await _supabase.auth.getUser();
        await _supabase.from('classes').insert([{ name, user_id: user.id }]);
        document.getElementById('className').value = ''; loadClasses();
    });

    clickAction('btnAddStudent', async () => {
        const name = document.getElementById('stName').value.trim();
        const rawNumber = document.getElementById('stNumber').value.trim();
        if (!name || !rawNumber) return alert('Nhập đủ Tên và STT');

        const numberToSave = parseInt(rawNumber, 10) || rawNumber;
        let { error } = await _supabase.from('students').insert([{ name, student_number: numberToSave, class_id: currentClassId, points: 0 }]);
        if (error && error.message.includes('points')) {
            const retry = await _supabase.from('students').insert([{ name, student_number: numberToSave, class_id: currentClassId }]);
            error = retry.error;
        }

        if (error) alert(error.message);
        else { document.getElementById('stName').value = ''; document.getElementById('stNumber').value = ''; loadStudents(); }
    });

    clickAction('btnRandom', () => {
        if (!currentStudents.length) return alert('Lớp trống');
        const s = currentStudents[Math.floor(Math.random() * currentStudents.length)];
        document.getElementById('random-result').innerHTML = `<small style="font-weight:400; color:var(--text-sub)">May mắn là:</small><br>${s.name}`;
    });

    clickAction('btnSaveSchool', () => saveSchedule('school'));
    clickAction('btnSaveExtra', () => saveSchedule('extra'));
});
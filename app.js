const SUPABASE_URL = 'https://wxeifjtogdqxebubkviv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZWlmanRvZ2RxeGVidWJrdml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTQ2NTAsImV4cCI6MjEwMDc5MDY1MH0.l2W0EbCKrCUPS7EjY0rCz1cPCzWy344SaBk4jATTA7I';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentClassId = null;
let currentStudents = [];
let currentUser = null;

// --- HÀM TRỢ GIÚP LẤY NGÀY HIỆN TẠI (YYYY-MM-DD) ---
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

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

// --- KIỂM TRA & CẬP NHẬT GIAO DIỆN USER ---
function applyUserSession(user) {
    currentUser = user;
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('userMenu');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const btnAvatar = document.getElementById('avatarBtn');

    if (user) {
        // ĐÃ ĐĂNG NHẬP
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (userEmailDisplay) userEmailDisplay.innerText = user.email;
        
        if (btnAvatar) {
            btnAvatar.innerText = user.email[0].toUpperCase();
            btnAvatar.onclick = (e) => { 
                e.stopPropagation(); 
                document.getElementById('userDropdown')?.classList.toggle('show'); 
            };
        }

        loadClasses();
        loadSchedule();
    } else {
        // CHƯA ĐĂNG NHẬP
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';

        if (window.location.pathname.includes('class.html') || window.location.pathname.includes('tkb.html')) {
            window.location.href = 'login.html';
        }
    }
}

// --- DATA CLASS ---
window.loadClasses = async function() {
    if (!window.location.pathname.includes('class.html')) return;
    if (!currentUser) return;

    const { data: classes } = await _supabase.from('classes').select('*').eq('user_id', currentUser.id);
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

    const today = getTodayString();
    let allChecked = currentStudents.length > 0;

    currentStudents.forEach(s => {
        const points = Number(s.points) || 0;
        const pointClass = points > 0 ? 'pos' : points < 0 ? 'neg' : '';
        const pointText = points > 0 ? `+${points}` : `${points}`;

        // Kiểm tra reset điểm danh sau 00:00 (Nếu ngày trong DB khác hôm nay)
        let isPresent = s.is_present;
        if (s.attendance_date !== today) {
            isPresent = false;
            _supabase.from('students').update({ is_present: false, attendance_date: today }).eq('id', s.id);
        }

        if (!isPresent) allChecked = false;

        list.innerHTML += `
            <div class="student-item">
                <input type="checkbox" 
                       style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary); margin-right: 12px;" 
                       ${isPresent ? 'checked' : ''} 
                       onclick="event.stopPropagation(); toggleAttendance('${s.id}', this.checked)" />
                <div class="student-info" onclick="openPointModal('${s.id}')">
                    <b>#${s.student_number}</b> ${s.name}
                </div>
                <span class="student-score ${pointClass}" onclick="openPointModal('${s.id}')">${pointText} điểm</span>
                <span class="delete-btn" onclick="deleteStudentEvent(event, '${s.id}')">✕</span>
            </div>`;
    });

    const checkAllBox = document.getElementById('checkAllAttendance');
    if (checkAllBox) checkAllBox.checked = allChecked;
}

// Xử lý tick điểm danh từng người
window.toggleAttendance = async (studentId, isChecked) => {
    const today = getTodayString();
    await _supabase.from('students').update({ 
        is_present: isChecked, 
        attendance_date: today 
    }).eq('id', studentId);

    const student = currentStudents.find(s => String(s.id) === String(studentId));
    if (student) {
        student.is_present = isChecked;
        student.attendance_date = today;
    }

    const checkAllBox = document.getElementById('checkAllAttendance');
    if (checkAllBox) {
        checkAllBox.checked = currentStudents.every(s => s.is_present);
    }
};

// Xử lý tick điểm danh tất cả
window.toggleCheckAll = async (isChecked) => {
    if (!currentStudents.length) return;
    const today = getTodayString();

    const ids = currentStudents.map(s => s.id);
    await _supabase.from('students').update({ 
        is_present: isChecked, 
        attendance_date: today 
    }).in('id', ids);

    loadStudents();
};

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

    if (!currentUser) return;

    const { data: items } = await _supabase.from('schedule').select('*').eq('user_id', currentUser.id);
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
    if (!currentUser) return alert("Vui lòng đăng nhập!");

    await _supabase.from('schedule').delete().eq('user_id', currentUser.id).eq('type', type);

    const payload = [];
    const maxSlot = type === 'school' ? 5 : 2;

    for (let slot = 1; slot <= maxSlot; slot++) {
        for (let day = 2; day <= 7; day++) {
            if (type === 'school') {
                const sub = document.getElementById(`sch_${day}_${slot}`)?.value.trim();
                if (sub) payload.push({ user_id: currentUser.id, type: 'school', day, slot, subject: sub });
            } else {
                const timeVal = document.getElementById(`ext_time_${day}_${slot}`)?.value.trim();
                const sub = document.getElementById(`ext_sub_${day}_${slot}`)?.value.trim();
                if (timeVal || sub) payload.push({ user_id: currentUser.id, type: 'extra', day, slot, time_val: timeVal, subject: sub });
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

// --- CÔNG CỤ: HẸN GIỜ VÀ ĐẾM GIỜ ---
let timerInterval = null;
let timerTotalSeconds = 0;

let stopwatchInterval = null;
let stopwatchTotalSeconds = 0;

function formatTwoDigits(num) {
    return String(num).padStart(2, '0');
}

// === HẸN GIỜ ===
window.openTimerModal = function() {
    closeToolsMenu();
    document.getElementById('toolModalOverlay')?.remove();
    const modalHTML = `
        <div id="toolModalOverlay" class="modal-overlay" onclick="closeToolModal(event)">
            <div class="tool-modal-card" onclick="event.stopPropagation()">
                <button class="close-modal-btn" onclick="closeToolModal()">✕</button>
                <h2>⏱️ Hẹn Giờ</h2>
                <div class="timer-inputs">
                    <div class="timer-input-group">
                        <label for="timerMinutes">Số phút</label>
                        <input type="number" id="timerMinutes" min="0" value="0" placeholder="0">
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 800; margin-top: 18px;">:</div>
                    <div class="timer-input-group">
                        <label for="timerSeconds">Số giây</label>
                        <input type="number" id="timerSeconds" min="0" max="59" value="0" placeholder="0">
                    </div>
                </div>
                <div class="timer-display" id="timerDisplay">00:00</div>
                <div class="tool-controls">
                    <button type="button" onclick="startTimer()">Bắt đầu</button>
                    <button type="button" class="warning" onclick="pauseTimer()">Dừng</button>
                    <button type="button" class="danger" onclick="resetTimer()">Đặt lại</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    updateTimerDisplay();
};

window.startTimer = function() {
    if (timerInterval) return;

    if (timerTotalSeconds <= 0) {
        const m = parseInt(document.getElementById('timerMinutes')?.value, 10) || 0;
        const s = parseInt(document.getElementById('timerSeconds')?.value, 10) || 0;
        timerTotalSeconds = m * 60 + s;
    }

    if (timerTotalSeconds <= 0) return alert("Vui lòng nhập số thời gian hẹn giờ!");

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timerTotalSeconds--;
        updateTimerDisplay();

        if (timerTotalSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            closeToolModal();
            showAlertModal("HẾT GIỜ!");
        }
    }, 1000);
};

window.pauseTimer = function() {
    clearInterval(timerInterval);
    timerInterval = null;
};

window.resetTimer = function() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerTotalSeconds = 0;
    const minInput = document.getElementById('timerMinutes');
    const secInput = document.getElementById('timerSeconds');
    if (minInput) minInput.value = 0;
    if (secInput) secInput.value = 0;
    updateTimerDisplay();
};

function updateTimerDisplay() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    const m = Math.floor(timerTotalSeconds / 60);
    const s = timerTotalSeconds % 60;
    display.innerText = `${formatTwoDigits(m)}:${formatTwoDigits(s)}`;
}

// === ĐẾM GIỜ ===
window.openStopwatchModal = function() {
    closeToolsMenu();
    document.getElementById('toolModalOverlay')?.remove();
    const modalHTML = `
        <div id="toolModalOverlay" class="modal-overlay" onclick="closeToolModal(event)">
            <div class="tool-modal-card" onclick="event.stopPropagation()">
                <button class="close-modal-btn" onclick="closeToolModal()">✕</button>
                <h2>⏲️ Đếm Giờ</h2>
                <div class="timer-display" id="stopwatchDisplay">00:00</div>
                <div class="tool-controls">
                    <button type="button" onclick="startStopwatch()">Bắt đầu</button>
                    <button type="button" class="warning" onclick="pauseStopwatch()">Dừng</button>
                    <button type="button" class="danger" onclick="resetStopwatch()">Đặt lại</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    updateStopwatchDisplay();
};

window.startStopwatch = function() {
    if (stopwatchInterval) return;

    stopwatchInterval = setInterval(() => {
        stopwatchTotalSeconds++;
        updateStopwatchDisplay();

        if (stopwatchTotalSeconds >= 3600) {
            clearInterval(stopwatchInterval);
            stopwatchInterval = null;
            showAlertModal("Đã đếm đến 60 phút!");
        }
    }, 1000);
};

window.pauseStopwatch = function() {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
};

window.resetStopwatch = function() {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    stopwatchTotalSeconds = 0;
    updateStopwatchDisplay();
};

function updateStopwatchDisplay() {
    const display = document.getElementById('stopwatchDisplay');
    if (!display) return;
    const m = Math.floor(stopwatchTotalSeconds / 60);
    const s = stopwatchTotalSeconds % 60;
    display.innerText = `${formatTwoDigits(m)}:${formatTwoDigits(s)}`;
}

window.closeToolModal = function(e) {
    if (!e || e.target.id === 'toolModalOverlay' || e.target.classList.contains('close-modal-btn')) {
        document.getElementById('toolModalOverlay')?.remove();
    }
};

window.showAlertModal = function(message) {
    document.getElementById('alertModalOverlay')?.remove();
    const modalHTML = `
        <div id="alertModalOverlay" class="modal-overlay" onclick="closeAlertModal(event)">
            <div class="alert-modal-card" onclick="event.stopPropagation()">
                <div class="alert-icon">🔔</div>
                <div class="alert-title">${message}</div>
                <button type="button" style="width: 100%; margin-top: 10px;" onclick="closeAlertModal()">Đóng</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeAlertModal = function(e) {
    if (!e || e.target.id === 'alertModalOverlay' || e.target.tagName === 'BUTTON') {
        document.getElementById('alertModalOverlay')?.remove();
    }
};

function closeToolsMenu() {
    const menu = document.querySelector('.tools-menu');
    if (menu) menu.classList.remove('show');
}

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    // Kiểm tra trực tiếp Session từ Supabase ngay khi load trang
    const { data: { session } } = await _supabase.auth.getSession();
    applyUserSession(session?.user || null);

    // Lắng nghe thay đổi auth (Đăng nhập / Đăng xuất)
    _supabase.auth.onAuthStateChange((event, session) => {
        applyUserSession(session?.user || null);
    });

    // Nút Bắt đầu ở trang chủ index.html
    const btnHeroStart = document.getElementById('btnHeroStart');
    if (btnHeroStart) {
        btnHeroStart.onclick = () => {
            if (currentUser) {
                window.location.href = 'class.html';
            } else {
                window.location.href = 'login.html';
            }
        };
    }

    // Toggle menu công cụ
    const toolsBtn = document.querySelector('.tools-btn');
    const toolsMenu = document.querySelector('.tools-menu');
    
    if (toolsBtn && toolsMenu) {
        toolsBtn.onclick = (e) => {
            e.stopPropagation();
            toolsMenu.classList.toggle('show');
        };
    }

    window.onclick = (e) => {
        document.getElementById('userDropdown')?.classList.remove('show');
        const container = document.querySelector('.dropdown-tools');
        if (container && !container.contains(e.target)) {
            closeToolsMenu();
        }
    };

    const clickAction = (id, func) => { const el = document.getElementById(id); if(el) el.onclick = func; };

    clickAction('btnLogin', async () => {
        const { error } = await _supabase.auth.signInWithPassword({ 
            email: document.getElementById('email').value, 
            password: document.getElementById('password').value 
        });
        if (error) alert(error.message); else window.location.href = 'class.html';
    });

    clickAction('btnRegister', async () => {
        const { error } = await _supabase.auth.signUp({ 
            email: document.getElementById('email').value, 
            password: document.getElementById('password').value 
        });
        if (error) alert(error.message); else alert("Đăng ký thành công!");
    });

    clickAction('btnLogout', async () => { 
        await _supabase.auth.signOut(); 
        window.location.href = 'index.html'; 
    });

    clickAction('btnAddClass', async () => {
        const name = document.getElementById('className').value;
        if (!name) return alert('Nhập tên lớp');
        if (!currentUser) return alert('Vui lòng đăng nhập');
        await _supabase.from('classes').insert([{ name, user_id: currentUser.id }]);
        document.getElementById('className').value = ''; loadClasses();
    });

    clickAction('btnAddStudent', async () => {
        const name = document.getElementById('stName').value.trim();
        const rawNumber = document.getElementById('stNumber').value.trim();
        if (!name || !rawNumber) return alert('Nhập đủ Tên và STT');

        const numberToSave = parseInt(rawNumber, 10) || rawNumber;
        const today = getTodayString();
        let { error } = await _supabase.from('students').insert([{ name, student_number: numberToSave, class_id: currentClassId, points: 0, is_present: false, attendance_date: today }]);
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
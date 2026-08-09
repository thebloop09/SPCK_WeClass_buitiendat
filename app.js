const SUPABASE_URL = 'https://wxeifjtogdqxebubkviv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZWlmanRvZ2RxeGVidWJrdml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTQ2NTAsImV4cCI6MjEwMDc5MDY1MH0.l2W0EbCKrCUPS7EjY0rCz1cPCzWy344SaBk4jATTA7I';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentClassId = null;
let currentClassGrade = 1;
let currentClassName = '';
let currentStudents = [];
let currentUser = null;
let isRandomizing = false;
let toastTimer = null;

window.showToast = function (message, type = 'info') {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }

    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    toast.className = 'app-toast ' + type;
    toast.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span></span>';
    toast.querySelector('span').textContent = message;
    requestAnimationFrame(() => toast.classList.add('show'));

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
};

// --- MÔN HỌC & CỘT ĐIỂM THEO CẤP ---
const PRIMARY_SUBJECTS = [
    'Tiếng Việt', 'Toán', 'Anh', 'Lịch sử và Địa lí', 'Khoa học', 'Tin học'
];
const PRIMARY_SCORE_KEYS = [
    { key: 'gk1', label: 'Giữa kì 1' },
    { key: 'ck1', label: 'Cuối kì 1' },
    { key: 'gk2', label: 'Giữa kì 2' },
    { key: 'ck2', label: 'Cuối kì 2' }
];

const SECONDARY_SUBJECTS = [
    'Văn', 'Toán', 'Tiếng Anh', 'Lịch sử Địa lí', 'Tin học',
    'Khoa học Tự nhiên', 'Công nghệ', 'Giáo dục Công dân'
];
const SECONDARY_SCORE_KEYS = [
    { key: 'mieng', label: 'Miệng' },
    { key: 'tx1', label: 'KT TX 1' },
    { key: 'tx2', label: 'KT TX 2' },
    { key: 'tx3', label: 'KT TX 3' },
    { key: 'gk1', label: 'Giữa kì 1' },
    { key: 'ck1', label: 'Cuối kì 1' },
    { key: 'gk2', label: 'Giữa kì 2' },
    { key: 'ck2', label: 'Cuối kì 2' }
];

function isPrimaryGrade(grade) {
    return grade >= 1 && grade <= 5;
}

function getSubjectsForGrade(grade) {
    return isPrimaryGrade(grade) ? PRIMARY_SUBJECTS : SECONDARY_SUBJECTS;
}

function getScoreKeysForGrade(grade) {
    return isPrimaryGrade(grade) ? PRIMARY_SCORE_KEYS : SECONDARY_SCORE_KEYS;
}

// --- HÀM TRỢ GIÚP LẤY NGÀY HIỆN TẠI (YYYY-MM-DD) ---
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

// --- THEME ---
function updateThemeUI(theme) {
    const el = document.getElementById('themeText');
    if (el) {
        el.innerHTML = theme === 'light'
            ? '<i class="fa-solid fa-moon"></i> Chế độ Tối'
            : '<i class="fa-solid fa-sun"></i> Chế độ Sáng';
    }
}

window.toggleTheme = function () {
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeUI(theme);
    showToast('Đã chuyển sang chế độ ' + (theme === 'light' ? 'sáng' : 'tối'), 'success');
};

// --- KIỂM TRA & CẬP NHẬT GIAO DIỆN USER ---
function applyUserSession(user) {
    currentUser = user;
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('userMenu');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const btnAvatar = document.getElementById('avatarBtn');

    if (user) {
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        if (userEmailDisplay) userEmailDisplay.innerText = user.email;

        if (btnAvatar) {
            btnAvatar.innerText = user.email[0].toUpperCase();
            btnAvatar.onclick = (e) => {
                e.stopPropagation();
                closeNotificationPanel();
                document.getElementById('userDropdown')?.classList.toggle('show');
            };
        }

        loadClasses();
        loadSchedule();
        startNotificationServices();
    } else {
        stopNotificationServices();
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';

        if (window.location.pathname.includes('class.html') || window.location.pathname.includes('tkb.html')) {
            window.location.href = 'login.html';
        }
    }
}


// ============================================================
// THÔNG BÁO WECLASS - SUPABASE
// ============================================================
let notificationsRealtimeChannel = null;
let notificationsPollTimer = null;
let notificationsLoadedOnce = false;

function notificationEscape(value) {
    return String(value ?? '').replace(/[&<>\"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' })[c];
    });
}

function notificationDateParts(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { time: '', date: '' };

    // Luôn hiển thị theo múi giờ Việt Nam, không phụ thuộc timezone của máy/server.
    const tz = 'Asia/Ho_Chi_Minh';
    return {
        time: new Intl.DateTimeFormat('vi-VN', {
            timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
        }).format(d),
        date: new Intl.DateTimeFormat('vi-VN', {
            timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(d)
    };
}

function ensureNotificationUI() {
    const userMenu = document.getElementById('userMenu') || document.querySelector('.user-menu');
    if (!userMenu || document.getElementById('notificationBtn')) return;

    const wrap = document.createElement('div');
    wrap.className = 'notification-wrap';
    wrap.innerHTML = `
        <button type="button" class="notification-btn" id="notificationBtn" aria-label="Thông báo" title="Thông báo">
            <i class="fa-solid fa-bell"></i>
            <span class="notification-dot" id="notificationDot"></span>
            <span class="notification-count" id="notificationCount">0</span>
        </button>
        <div class="notification-panel" id="notificationPanel" aria-hidden="true">
            <div class="notification-panel-head">
                <div>
                    <div class="notification-panel-title"><i class="fa-solid fa-bell"></i> Thông báo</div>
                    <div class="notification-panel-sub" id="notificationSub">Đang tải...</div>
                </div>
                <button type="button" class="notification-close" id="notificationClose" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="notification-list" id="notificationList">
                <div class="notification-empty"><i class="fa-regular fa-bell-slash"></i><b>Chưa có thông báo</b><span>Mọi cập nhật quan trọng sẽ xuất hiện ở đây.</span></div>
            </div>
        </div>`;

    // Chèn ngay trước avatar để nằm cạnh avatar.
    const avatar = userMenu.querySelector('#avatarBtn');
    if (avatar) userMenu.insertBefore(wrap, avatar);
    else userMenu.appendChild(wrap);

    const btn = document.getElementById('notificationBtn');
    btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const panel = document.getElementById('notificationPanel');
        const isOpen = panel?.classList.contains('show');
        closeUserDropdownOnly();
        if (!isOpen) {
            panel?.classList.add('show');
            panel?.setAttribute('aria-hidden', 'false');
            await loadNotifications();
            await markAllNotificationsRead();
        } else {
            closeNotificationPanel();
        }
    });
    document.getElementById('notificationClose')?.addEventListener('click', function (e) {
        e.stopPropagation();
        closeNotificationPanel();
    });
}

function closeUserDropdownOnly() {
    document.getElementById('userDropdown')?.classList.remove('show');
}

function closeNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel?.classList.remove('show');
    panel?.setAttribute('aria-hidden', 'true');
}

function updateNotificationBadge(items) {
    const unread = (items || []).filter(n => !n.read_at).length;
    const dot = document.getElementById('notificationDot');
    const count = document.getElementById('notificationCount');
    if (dot) dot.classList.toggle('show', unread > 0);
    if (count) {
        count.textContent = unread > 9 ? '9+' : String(unread);
        count.classList.toggle('show', unread > 0);
    }
    const sub = document.getElementById('notificationSub');
    if (sub) sub.textContent = unread > 0 ? unread + ' thông báo chưa đọc' : 'Tối đa 5 thông báo gần nhất';
}

function renderNotifications(items) {
    const list = document.getElementById('notificationList');
    if (!list) return;
    if (!items || !items.length) {
        list.innerHTML = '<div class="notification-empty"><i class="fa-regular fa-bell-slash"></i><b>Chưa có thông báo</b><span>Mọi cập nhật quan trọng sẽ xuất hiện ở đây.</span></div>';
        updateNotificationBadge([]);
        return;
    }
    list.innerHTML = items.map(n => {
        const p = notificationDateParts(n.created_at);
        return `<button type="button" class="notification-item ${n.read_at ? '' : 'unread'}" data-notification-id="${notificationEscape(n.id)}">
            <span class="notification-item-icon"><i class="fa-solid ${notificationEscape(n.icon || 'fa-bell')}"></i></span>
            <span class="notification-item-body">
                <strong>${notificationEscape(n.title)}</strong>
                ${n.message ? `<span class="notification-message">${notificationEscape(n.message)}</span>` : ''}
                <small><i class="fa-regular fa-clock"></i> ${p.time} · ${p.date}</small>
            </span>
            ${!n.read_at ? '<span class="notification-unread-dot"></span>' : ''}
        </button>`;
    }).join('');

    list.querySelectorAll('.notification-item').forEach(el => {
        el.addEventListener('click', async function () {
            const id = this.dataset.notificationId;
            if (!id) return;
            await _supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', currentUser.id);
            await loadNotifications();
        });
    });
    updateNotificationBadge(items);
}

async function loadNotifications() {
    if (!currentUser) return [];
    ensureNotificationUI();
    const { data, error } = await _supabase
        .from('notifications')
        .select('id,user_id,title,message,icon,source_key,created_at,read_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5);
    if (error) {
        console.warn('Không tải được notifications:', error.message);
        const sub = document.getElementById('notificationSub');
        if (sub) sub.textContent = 'Không tải được thông báo';
        return [];
    }
    notificationsLoadedOnce = true;
    renderNotifications(data || []);
    return data || [];
}

async function markAllNotificationsRead() {
    if (!currentUser) return;
    await _supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .is('read_at', null);
    await loadNotifications();
}

async function createNotification(title, message = '', icon = 'fa-bell', sourceKey = null) {
    if (!currentUser) return;
    const payload = {
        user_id: currentUser.id,
        title,
        message,
        icon,
        source_key: sourceKey || null,
        // Ghi thời điểm tạo từ thiết bị theo ISO UTC. Supabase sẽ lưu đúng instant,
        // sau đó giao diện đổi sang Asia/Ho_Chi_Minh khi hiển thị.
        created_at: new Date().toISOString()
    };
    const { error } = await _supabase.from('notifications').insert(payload);
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
        console.warn('Tạo notification thất bại:', error.message);
        return;
    }
    await loadNotifications();
}

function setupNotificationsRealtime() {
    if (!currentUser) return;
    if (notificationsRealtimeChannel) {
        try { _supabase.removeChannel(notificationsRealtimeChannel); } catch (_) {}
        notificationsRealtimeChannel = null;
    }
    notificationsRealtimeChannel = _supabase
        .channel('weclass-notifications-' + currentUser.id)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + currentUser.id
        }, function () {
            loadNotifications();
        })
        .subscribe();
}

function parseScheduleStartMinutes(value) {
    if (!value) return null;
    const m = String(value).match(/(\d{1,2})\s*(?:h|:|g)\s*(\d{0,2})?/i);
    if (!m) return null;
    const hour = Number(m[1]);
    const minute = Number(m[2] || 0);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
}

async function checkTodayScheduleNotifications() {
    if (!currentUser) return;
    const now = new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay() + 1; // JS CN=0 -> T2=2 ... T7=7
    const todayKey = getTodayString();
    const { data: items, error } = await _supabase.from('schedule').select('*').eq('user_id', currentUser.id).eq('day', day);
    if (error || !items) return;

    const todayItems = items.filter(x => x.subject || x.time_val);
    if (todayItems.length && now.getHours() < 12) {
        await createNotification(
            'Hôm nay bạn có lịch dạy',
            'Bạn có ' + todayItems.length + ' lịch trong thời khóa biểu hôm nay.',
            'fa-calendar-day',
            'daily-schedule-' + todayKey
        );
    }

    for (const item of todayItems) {
        if (item.type !== 'extra' || !item.time_val) continue;
        const start = parseScheduleStartMinutes(item.time_val);
        if (start === null) continue;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (currentMinutes >= start - 30 && currentMinutes < start) {
            await createNotification(
                'Sắp đến giờ dạy',
                (item.subject || 'Lịch dạy thêm') + ' · ' + item.time_val,
                'fa-clock',
                'schedule-reminder-' + todayKey + '-' + item.id
            );
        }
    }
}

function startNotificationServices() {
    if (!currentUser) return;
    ensureNotificationUI();
    loadNotifications();
    setupNotificationsRealtime();
    checkTodayScheduleNotifications();
    if (notificationsPollTimer) clearInterval(notificationsPollTimer);
    notificationsPollTimer = setInterval(function () {
        if (document.visibilityState === 'visible' && currentUser) {
            checkTodayScheduleNotifications();
            loadNotifications();
        }
    }, 60000);
}

function stopNotificationServices() {
    if (notificationsPollTimer) clearInterval(notificationsPollTimer);
    notificationsPollTimer = null;
    if (notificationsRealtimeChannel) {
        try { _supabase.removeChannel(notificationsRealtimeChannel); } catch (_) {}
        notificationsRealtimeChannel = null;
    }
    closeNotificationPanel();
    document.getElementById('notificationBtn')?.remove();
    document.querySelector('.notification-wrap')?.remove();
}

// --- DATA CLASS ---
window.loadClasses = async function () {
    if (!window.location.pathname.includes('class.html')) return;
    if (!currentUser) return;

    const { data: classes } = await _supabase.from('classes').select('*').eq('user_id', currentUser.id);
    const list = document.getElementById('class-list');
    if (!list) return;
    list.innerHTML = '';

    if (!classes || !classes.length) {
        list.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-sub)">Chưa có lớp nào.</p>';
        return;
    }

    classes.forEach(cls => {
        const grade = Number(cls.grade_level) || 1;
        const capLabel = isPrimaryGrade(grade) ? 'Cấp 1' : 'Cấp 2';

        const item = document.createElement('div');
        item.className = 'class-item';
        item.innerHTML =
            '<span class="class-icon"><i class="fa-solid fa-chalkboard-user"></i></span>' +
            '<h4></h4>' +
            '<p style="color:var(--text-sub); font-size:0.85rem; margin-bottom:1rem;">Khối ' + grade + ' · ' + capLabel + '</p>' +
            '<div class="class-actions">' +
            '<button type="button" class="btn-vao-hoc">Vào học</button>' +
            '<button type="button" class="danger btn-xoa-lop">Xóa</button>' +
            '</div>';
        item.querySelector('h4').textContent = cls.name || '';

        item.querySelector('.btn-vao-hoc').addEventListener('click', function () {
            viewClass(String(cls.id), cls.name || '', grade);
        });
        item.querySelector('.btn-xoa-lop').addEventListener('click', function () {
            deleteClass(String(cls.id));
        });

        list.appendChild(item);
    });
};

window.viewClass = (id, name, grade) => {
    currentClassId = id;
    currentClassName = name;
    currentClassGrade = grade || 1;
    document.getElementById('class-section').classList.add('hidden');
    document.getElementById('student-section').classList.remove('hidden');
    document.getElementById('current-class-title').innerText = `${name} (Khối ${currentClassGrade})`;
    loadStudents();
};

window.showClasses = () => {
    document.getElementById('class-section').classList.remove('hidden');
    document.getElementById('student-section').classList.add('hidden');
};

window.deleteClass = async (id) => {
    if (confirm('Xóa lớp? Toàn bộ học sinh và học bạ sẽ bị xóa theo.')) {
        await _supabase.from('classes').delete().eq('id', id);
        loadClasses();
    }
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

    const logsToUpsert = [];
    const studentUpdates = [];

    currentStudents.forEach(s => {
        let isPresent = !!s.is_present;
        if (s.attendance_date !== today) {
            isPresent = false;
            s.is_present = false;
            s.attendance_date = today;
            studentUpdates.push(s.id);
        }
        logsToUpsert.push({
            student_id: s.id,
            attendance_date: today,
            is_present: isPresent
        });
        if (!isPresent) allChecked = false;
    });

    if (studentUpdates.length > 0) {
        try {
            await _supabase.from('students')
                .update({ is_present: false, attendance_date: today })
                .in('id', studentUpdates);
        } catch (e) { console.warn('reset attendance_date:', e); }
    }

    if (logsToUpsert.length > 0) {
        try {
            await _supabase.from('attendance_logs').upsert(
                logsToUpsert,
                { onConflict: 'student_id,attendance_date' }
            );
        } catch (e) { console.warn('attendance_logs upsert on load:', e); }
    }

    currentStudents.forEach(s => {
        const points = Number(s.points) || 0;
        const pointClass = points > 0 ? 'pos' : points < 0 ? 'neg' : '';
        const pointText = points > 0 ? ('+' + points) : String(points);

        const isPresent = !!s.is_present;

        const row = document.createElement('div');
        row.className = 'student-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.style.cssText = 'width:20px;height:20px;cursor:pointer;accent-color:var(--primary);margin-right:12px;';
        cb.checked = isPresent;
        cb.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleAttendance(String(s.id), cb.checked);
        });

        const info = document.createElement('div');
        info.className = 'student-info';
        info.innerHTML = '<b>#' + (s.student_number || '') + '</b> ';
        info.appendChild(document.createTextNode(s.name || ''));
        info.addEventListener('click', function () { openPointModal(String(s.id)); });

        const score = document.createElement('span');
        score.className = 'student-score ' + pointClass;
        score.textContent = pointText + ' điểm';
        score.addEventListener('click', function () { openPointModal(String(s.id)); });

        const btnHb = document.createElement('button');
        btnHb.type = 'button';
        btnHb.className = 'btn-hocba';
        btnHb.innerHTML = '<i class="fa-solid fa-book-open"></i> Học bạ';
        btnHb.addEventListener('click', function (e) {
            e.stopPropagation();
            openGradebook(String(s.id));
        });

        const del = document.createElement('span');
        del.className = 'delete-btn';
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        del.addEventListener('click', function (e) {
            deleteStudentEvent(e, String(s.id));
        });

        row.appendChild(cb);
        row.appendChild(info);
        row.appendChild(score);
        row.appendChild(btnHb);
        row.appendChild(del);
        list.appendChild(row);
    });

    const checkAllBox = document.getElementById('checkAllAttendance');
    if (checkAllBox) checkAllBox.checked = allChecked;

    updateAttendanceStats();
}

// Cập nhật thanh thống kê
function updateAttendanceStats() {
    const total = currentStudents.length;
    const present = currentStudents.filter(s => !!s.is_present).length;
    const absent = total - present;

    const elTotal = document.getElementById('statTotal');
    const elPresent = document.getElementById('statPresent');
    const elAbsent = document.getElementById('statAbsent');
    if (elTotal) elTotal.textContent = total;
    if (elPresent) elPresent.textContent = present;
    if (elAbsent) elAbsent.textContent = absent;
}

// Xử lý tick điểm danh
window.toggleAttendance = async (studentId, isChecked) => {
    const today = getTodayString();
    await _supabase.from('students').update({
        is_present: isChecked,
        attendance_date: today
    }).eq('id', studentId);

    try {
        await _supabase.from('attendance_logs').upsert({
            student_id: studentId,
            attendance_date: today,
            is_present: isChecked
        }, { onConflict: 'student_id,attendance_date' });
    } catch (e) { console.warn('attendance_logs:', e); }

    const student = currentStudents.find(s => String(s.id) === String(studentId));
    if (student) {
        student.is_present = isChecked;
        student.attendance_date = today;
    }

    const checkAllBox = document.getElementById('checkAllAttendance');
    if (checkAllBox) {
        checkAllBox.checked = currentStudents.every(s => s.is_present);
    }

    updateAttendanceStats();
};

window.toggleCheckAll = async (isChecked) => {
    if (!currentStudents.length) return;
    const today = getTodayString();

    const ids = currentStudents.map(s => s.id);
    await _supabase.from('students').update({
        is_present: isChecked,
        attendance_date: today
    }).in('id', ids);

    try {
        const logs = ids.map(id => ({
            student_id: id,
            attendance_date: today,
            is_present: isChecked
        }));
        await _supabase.from('attendance_logs').upsert(logs, { onConflict: 'student_id,attendance_date' });
    } catch (e) { console.warn('attendance_logs:', e); }

    loadStudents();
};

window.deleteStudentEvent = async (event, id) => {
    event.stopPropagation();
    if (confirm('Xóa học sinh này? Học bạ và điểm danh liên quan cũng sẽ bị xóa.')) {
        await _supabase.from('students').delete().eq('id', id);
        loadStudents();
    }
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
                <button class="close-modal-btn" onclick="closePointModal()"><i class="fa-solid fa-xmark"></i></button>
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
    if (!input || isNaN(parseInt(input, 10)) || parseInt(input, 10) <= 0) {
        if (input !== null) showToast('Vui lòng nhập số điểm hợp lệ.', 'error');
        return;
    }

    const amount = parseInt(input, 10);
    const student = currentStudents.find(s => String(s.id) === String(studentId));
    const newPoints = (Number(student.points) || 0) + (type === 1 ? amount : -amount);

    await _supabase.from('students').update({ points: newPoints }).eq('id', studentId);
    closePointModal();
    showToast(type === 1 ? 'Đã cộng điểm cho học sinh.' : 'Đã trừ điểm của học sinh.', 'success');
    loadStudents();
};

// ============================================================
// HỌC BẠ ĐIỆN TỬ  (hàm openGradebook chính nằm ở cuối file, có AI đánh giá)
// ============================================================

function parseScore(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).trim().replace(',', '.');
    if (s === '') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

function round1(n) {
    return Math.round(n * 10) / 10;
}

function calcSemesterAvg(scores, gkKey, ckKey) {
    const txKeys = ['mieng', 'tx1', 'tx2', 'tx3'];
    let sumTx = 0;
    let countTx = 0;
    txKeys.forEach(function (k) {
        const v = parseScore(scores[k]);
        if (v !== null) {
            sumTx += v;
            countTx++;
        }
    });
    const gk = parseScore(scores[gkKey]);
    const ck = parseScore(scores[ckKey]);
    if (gk === null && ck === null && countTx === 0) return null;
    const num = sumTx + (gk !== null ? 2 * gk : 0) + (ck !== null ? 3 * ck : 0);
    const den = countTx + 5;
    if (den <= 0) return null;
    return round1(num / den);
}

function calcYearAvg(dtb1, dtb2) {
    if (dtb1 === null && dtb2 === null) return null;
    const a = dtb1 !== null ? dtb1 : 0;
    const b = dtb2 !== null ? dtb2 : 0;
    if (dtb1 === null || dtb2 === null) {
        return null;
    }
    return round1((a + 2 * b) / 3);
}

function formatAvg(val) {
    if (val === null || val === undefined) return '—';
    return val.toFixed(1);
}

/** Cấp 1: tính mức hoàn thành 1 môn từ điểm kiểm tra định kỳ (gk1, ck1, gk2, ck2) */
function calcPrimaryCompletion(scores) {
    const keys = ['gk1', 'ck1', 'gk2', 'ck2'];
    const vals = [];
    keys.forEach(function (k) {
        const v = parseScore(scores[k]);
        if (v !== null && v >= 0 && v <= 10) vals.push(v);
    });
    if (vals.length === 0) {
        return {
            level: null,
            label: 'Chưa đủ dữ liệu',
            desc: 'Chưa có điểm kiểm tra định kỳ (Giữa kì / Cuối kì) để đánh giá mức hoàn thành.',
            css: 'pending',
            avg: null
        };
    }
    const avg = round1(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
    if (avg >= 9.0) {
        return {
            level: 'tot',
            label: 'Hoàn thành tốt',
            desc: 'Học sinh thực hiện tốt các yêu cầu học tập của môn học, bài kiểm tra định kỳ đạt từ 9.0 – 10 điểm (TB ≈ ' + avg.toFixed(1) + ').',
            css: 'tot',
            avg: avg
        };
    }
    if (avg >= 5.0) {
        return {
            level: 'hoanthanh',
            label: 'Hoàn thành',
            desc: 'Học sinh thực hiện được các yêu cầu học tập của môn học, bài kiểm tra định kỳ đạt từ 5.0 – 8.0 điểm (TB ≈ ' + avg.toFixed(1) + ').',
            css: 'hoanthanh',
            avg: avg
        };
    }
    return {
        level: 'chua',
        label: 'Chưa hoàn thành',
        desc: 'Học sinh chưa thực hiện được các yêu cầu học tập, bài kiểm tra định kỳ dưới 5.0 điểm (TB ≈ ' + avg.toFixed(1) + '). Sẽ được giáo viên hướng dẫn, hỗ trợ học lại để kiểm tra bổ sung.',
        css: 'chua',
        avg: avg
    };
}

function renderPrimaryCompletionBox(comp) {
    if (!comp) return '';
    return (
        '<div class="gb-avg-section gb-primary-complete-section">' +
        '  <div class="gb-section-label">Mức hoàn thành môn (tự động)</div>' +
        '  <div class="gb-complete-badge gb-complete-' + comp.css + '" id="primaryCompleteBox">' +
        '    <span class="gb-complete-icon"><i class="fa-solid fa-award"></i></span>' +
        '    <div>' +
        '      <div class="gb-complete-label" id="primaryCompleteLabel">' + comp.label + '</div>' +
        '      <div class="gb-complete-desc" id="primaryCompleteDesc">' + comp.desc + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="gb-avg-hint">Cấp 1: Hoàn thành tốt (9.0–10) · Hoàn thành (5.0–8.0) · Chưa hoàn thành (&lt;5.0). Tự lưu khi bấm Lưu điểm.</div>' +
        '</div>'
    );
}

window.openSubjectScores = function (subject) {
    const cache = window._gbCache;
    if (!cache) return;

    const student = cache.student;
    const gradeMap = cache.gradeMap || {};
    const scoreKeys = getScoreKeysForGrade(currentClassGrade);
    const isPrimary = isPrimaryGrade(currentClassGrade);
    const subScores = gradeMap[subject] || {};

    document.getElementById('subjectScoreOverlay')?.remove();

    let cells = '';
    scoreKeys.forEach(function (sk) {
        const val = subScores[sk.key] || '';
        cells +=
            '<div class="gb-cell">' +
            '<label>' + sk.label + '</label>' +
            '<input type="text" class="gb-input" data-key="' + sk.key + '" value="' +
            String(val).replace(/"/g, '&quot;') + '" placeholder="—" inputmode="decimal">' +
            '</div>';
    });

    const commentVal = subScores['comment'] || '';
    cells +=
        '<div class="gb-cell gb-comment-cell">' +
        '<label>Nhận xét giáo viên</label>' +
        '<textarea class="gb-input gb-comment" data-key="comment" rows="3" placeholder="Nhận xét...">' +
        String(commentVal).replace(/</g, '&lt;') +
        '</textarea></div>';

    let avgSection = '';
    if (isPrimary) {
        const initComp = calcPrimaryCompletion(subScores);
        avgSection = renderPrimaryCompletionBox(initComp);
    } else {
        avgSection =
            '<div class="gb-avg-section">' +
            '  <div class="gb-section-label">Điểm trung bình môn (tự động)</div>' +
            '  <div class="gb-avg-grid">' +
            '    <div class="gb-avg-box">' +
            '      <span class="gb-avg-label">ĐTB HK1</span>' +
            '      <span class="gb-avg-value" id="avgHk1">—</span>' +
            '    </div>' +
            '    <div class="gb-avg-box">' +
            '      <span class="gb-avg-label">ĐTB HK2</span>' +
            '      <span class="gb-avg-value" id="avgHk2">—</span>' +
            '    </div>' +
            '    <div class="gb-avg-box year">' +
            '      <span class="gb-avg-label">ĐTB cả năm</span>' +
            '      <span class="gb-avg-value" id="avgYear">—</span>' +
            '    </div>' +
            '  </div>' +
            '  <div class="gb-avg-hint">Công thức: (ΣTX + 2×GK + 3×CK) / (số bài TX + 5) · Cả năm = (HK1 + 2×HK2) / 3</div>' +
            '</div>';
    }

    const html =
        '<div id="subjectScoreOverlay" class="modal-overlay">' +
        '  <div class="gradebook-modal gb-score-modal" onclick="event.stopPropagation()">' +
        '    <button type="button" class="close-modal-btn" id="subScoreCloseBtn"><i class="fa-solid fa-xmark"></i></button>' +
        '    <div class="gb-score-header">' +
        '      <button type="button" class="gb-back-btn" id="subScoreBackBtn">← Quay lại</button>' +
        '      <h3 class="gb-score-title"></h3>' +
        '      <div class="gb-score-sub"></div>' +
        '    </div>' +
        '    <div class="gb-scores-grid ' + (isPrimary ? 'primary' : 'secondary') + '">' + cells + '</div>' +
        avgSection +
        '    <div class="gb-footer">' +
        '      <button type="button" class="btn-save-gb" id="btnSaveSubjectScore"><i class="fa-solid fa-floppy-disk"></i> Lưu điểm môn này</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';

    document.body.insertAdjacentHTML('beforeend', html);

    const ov = document.getElementById('subjectScoreOverlay');
    ov.querySelector('.gb-score-title').textContent = subject;
    ov.querySelector('.gb-score-sub').textContent =
        '#' + (student.student_number || '') + ' · ' + (student.name || '');

    ov.addEventListener('click', function (e) {
        if (e.target.id === 'subjectScoreOverlay') closeSubjectScores();
    });
    document.getElementById('subScoreCloseBtn').addEventListener('click', closeSubjectScores);
    document.getElementById('subScoreBackBtn').addEventListener('click', closeSubjectScores);

    document.getElementById('btnSaveSubjectScore').addEventListener('click', async function () {
        await saveSubjectScores(cache.studentId, subject);
    });

    if (isPrimary) {
        function refreshPrimaryComplete() {
            const scores = {};
            ov.querySelectorAll('.gb-input[data-key]').forEach(function (inp) {
                scores[inp.getAttribute('data-key')] = inp.value;
            });
            const comp = calcPrimaryCompletion(scores);
            const box = document.getElementById('primaryCompleteBox');
            const lab = document.getElementById('primaryCompleteLabel');
            const desc = document.getElementById('primaryCompleteDesc');
            if (box) {
                box.className = 'gb-complete-badge gb-complete-' + comp.css;
            }
            if (lab) lab.textContent = comp.label;
            if (desc) desc.textContent = comp.desc;
        }
        ov.querySelectorAll('.gb-input').forEach(function (inp) {
            inp.addEventListener('input', refreshPrimaryComplete);
        });
        refreshPrimaryComplete();
    } else {
        function refreshAvgs() {
            const scores = {};
            ov.querySelectorAll('.gb-input[data-key]').forEach(function (inp) {
                scores[inp.getAttribute('data-key')] = inp.value;
            });
            const dtb1 = calcSemesterAvg(scores, 'gk1', 'ck1');
            const dtb2 = calcSemesterAvg(scores, 'gk2', 'ck2');
            const dtbYear = calcYearAvg(dtb1, dtb2);
            const el1 = document.getElementById('avgHk1');
            const el2 = document.getElementById('avgHk2');
            const elY = document.getElementById('avgYear');
            if (el1) el1.textContent = formatAvg(dtb1);
            if (el2) el2.textContent = formatAvg(dtb2);
            if (elY) elY.textContent = formatAvg(dtbYear);
        }
        ov.querySelectorAll('.gb-input').forEach(function (inp) {
            inp.addEventListener('input', refreshAvgs);
        });
        refreshAvgs();
    }
};

window.closeSubjectScores = function () {
    document.getElementById('subjectScoreOverlay')?.remove();
};

window.saveSubjectScores = async function (studentId, subject) {
    const ov = document.getElementById('subjectScoreOverlay');
    if (!ov) return;

    const inputs = ov.querySelectorAll('.gb-input');
    const payload = [];
    const scores = {};

    inputs.forEach(function (inp) {
        const key = inp.getAttribute('data-key');
        const value = (inp.value || '').trim();
        scores[key] = value;
        if (value !== '') {
            payload.push({
                student_id: studentId,
                subject: subject,
                score_key: key,
                score_value: value,
                updated_at: new Date().toISOString()
            });
        }
    });

    const now = new Date().toISOString();

    if (isPrimaryGrade(currentClassGrade)) {
        // Cấp 1: lưu mức hoàn thành + điểm TB môn
        const comp = calcPrimaryCompletion(scores);
        if (comp.level) {
            payload.push({
                student_id: studentId,
                subject: subject,
                score_key: 'muc_hoan_thanh',
                score_value: comp.label,
                updated_at: now
            });
        }
        if (comp.avg !== null) {
            payload.push({
                student_id: studentId,
                subject: subject,
                score_key: 'dtb_mon',
                score_value: comp.avg.toFixed(1),
                updated_at: now
            });
        }
    } else {
        const dtb1 = calcSemesterAvg(scores, 'gk1', 'ck1');
        const dtb2 = calcSemesterAvg(scores, 'gk2', 'ck2');
        const dtbYear = calcYearAvg(dtb1, dtb2);

        if (dtb1 !== null) {
            payload.push({
                student_id: studentId,
                subject: subject,
                score_key: 'dtb_hk1',
                score_value: dtb1.toFixed(1),
                updated_at: now
            });
        }
        if (dtb2 !== null) {
            payload.push({
                student_id: studentId,
                subject: subject,
                score_key: 'dtb_hk2',
                score_value: dtb2.toFixed(1),
                updated_at: now
            });
        }
        if (dtbYear !== null) {
            payload.push({
                student_id: studentId,
                subject: subject,
                score_key: 'dtb_cn',
                score_value: dtbYear.toFixed(1),
                updated_at: now
            });
        }
    }

    try {
        await _supabase.from('grades').delete()
            .eq('student_id', studentId)
            .eq('subject', subject);

        if (payload.length > 0) {
            const { error } = await _supabase.from('grades').insert(payload);
            if (error) {
                showToast('Lỗi khi lưu: ' + error.message, 'error');
                return;
            }
        }

        if (window._gbCache) {
            if (!window._gbCache.gradeMap[subject]) window._gbCache.gradeMap[subject] = {};
            window._gbCache.gradeMap[subject] = {};
            payload.forEach(function (p) {
                window._gbCache.gradeMap[subject][p.score_key] = p.score_value;
            });
        }

        showToast('Đã lưu điểm môn "' + subject + '" thành công!', 'success');
        closeSubjectScores();
    } catch (e) {
        showToast('Lỗi: ' + e.message, 'error');
    }
};

window.closeGradebook = function (e) {
    if (!e || e.target?.id === 'gradebookOverlay' || e.target?.classList?.contains('close-modal-btn') || e.target?.id === 'gbCloseBtn') {
        document.getElementById('subjectScoreOverlay')?.remove();
        document.getElementById('gradebookOverlay')?.remove();
    }
};

// --- PHẦN XỬ LÝ THỜI KHÓA BIỂU (TKB) ---
function renderEmptyTables() {
    const schoolTbody = document.querySelector('#table-school tbody');
    const extraTbody = document.querySelector('#table-extra tbody');
    if (!schoolTbody || !extraTbody) return;

    schoolTbody.innerHTML = '';
    for (let slot = 1; slot <= 5; slot++) {
        let row = '<tr><td class="slot-label">Tiết ' + slot + '</td>';
        for (let day = 2; day <= 7; day++) {
            row += '<td><input type="text" id="sch_' + day + '_' + slot + '" placeholder="Môn học..."></td>';
        }
        row += '</tr>';
        schoolTbody.innerHTML += row;
    }

    extraTbody.innerHTML = '';
    for (let slot = 1; slot <= 2; slot++) {
        let row = '<tr><td class="slot-label">Ca ' + slot + '</td>';
        for (let day = 2; day <= 7; day++) {
            row += '<td>' +
                '<input type="text" class="time-input" id="ext_time_' + day + '_' + slot + '" placeholder="Giờ (vd: 17h-19h)">' +
                '<input type="text" id="ext_sub_' + day + '_' + slot + '" placeholder="Môn / Lớp...">' +
                '</td>';
        }
        row += '</tr>';
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
            const el = document.getElementById('sch_' + item.day + '_' + item.slot);
            if (el) el.value = item.subject || '';
        } else if (item.type === 'extra') {
            const elTime = document.getElementById('ext_time_' + item.day + '_' + item.slot);
            const elSub = document.getElementById('ext_sub_' + item.day + '_' + item.slot);
            if (elTime) elTime.value = item.time_val || '';
            if (elSub) elSub.value = item.subject || '';
        }
    });
}

async function saveSchedule(type) {
    if (!currentUser) return showToast('Vui lòng đăng nhập!', 'error');

    await _supabase.from('schedule').delete().eq('user_id', currentUser.id).eq('type', type);

    const payload = [];
    const maxSlot = type === 'school' ? 5 : 2;

    for (let slot = 1; slot <= maxSlot; slot++) {
        for (let day = 2; day <= 7; day++) {
            if (type === 'school') {
                const sub = document.getElementById('sch_' + day + '_' + slot)?.value.trim();
                if (sub) payload.push({ user_id: currentUser.id, type: 'school', day: day, slot: slot, subject: sub });
            } else {
                const timeVal = document.getElementById('ext_time_' + day + '_' + slot)?.value.trim();
                const sub = document.getElementById('ext_sub_' + day + '_' + slot)?.value.trim();
                if (timeVal || sub) payload.push({ user_id: currentUser.id, type: 'extra', day: day, slot: slot, time_val: timeVal, subject: sub });
            }
        }
    }

    if (payload.length > 0) {
        const { error } = await _supabase.from('schedule').insert(payload);
        if (error) showToast('Lỗi khi lưu: ' + error.message, 'error');
        else {
            showToast('Lưu Thời Khóa Biểu thành công!', 'success');
            await createNotification(
                type === 'school' ? 'Đã cập nhật thời khóa biểu trường' : 'Đã cập nhật lịch dạy thêm',
                type === 'school' ? 'Thời khóa biểu trường đã được lưu trên tài khoản của bạn.' : 'Lịch dạy thêm đã được lưu và đồng bộ qua Supabase.',
                type === 'school' ? 'fa-school' : 'fa-chalkboard-user',
                'schedule-saved-' + type + '-' + Date.now()
            );
        }
    } else {
        showToast('Đã xóa trống lịch biểu!', 'success');
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

window.openTimerModal = function () {
    closeToolsMenu();
    document.getElementById('toolModalOverlay')?.remove();
    const modalHTML = `
        <div id="toolModalOverlay" class="modal-overlay" onclick="closeToolModal(event)">
            <div class="tool-modal-card" onclick="event.stopPropagation()">
                <button class="close-modal-btn" onclick="closeToolModal()"><i class="fa-solid fa-xmark"></i></button>
                <h2><i class="fa-solid fa-clock"></i> Hẹn Giờ</h2>
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

window.startTimer = function () {
    if (timerInterval) return;

    if (timerTotalSeconds <= 0) {
        const m = parseInt(document.getElementById('timerMinutes')?.value, 10) || 0;
        const s = parseInt(document.getElementById('timerSeconds')?.value, 10) || 0;
        timerTotalSeconds = m * 60 + s;
    }

    if (timerTotalSeconds <= 0) return showToast('Vui lòng nhập số thời gian hẹn giờ!', 'error');

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timerTotalSeconds--;
        updateTimerDisplay();

        if (timerTotalSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            closeToolModal();
            showAlertModal('HẾT GIỜ!');
        }
    }, 1000);
};

window.pauseTimer = function () {
    clearInterval(timerInterval);
    timerInterval = null;
};

window.resetTimer = function () {
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

window.openStopwatchModal = function () {
    closeToolsMenu();
    document.getElementById('toolModalOverlay')?.remove();
    const modalHTML = `
        <div id="toolModalOverlay" class="modal-overlay" onclick="closeToolModal(event)">
            <div class="tool-modal-card" onclick="event.stopPropagation()">
                <button class="close-modal-btn" onclick="closeToolModal()"><i class="fa-solid fa-xmark"></i></button>
                <h2><i class="fa-solid fa-stopwatch"></i> Đếm Giờ</h2>
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

window.startStopwatch = function () {
    if (stopwatchInterval) return;

    stopwatchInterval = setInterval(() => {
        stopwatchTotalSeconds++;
        updateStopwatchDisplay();

        if (stopwatchTotalSeconds >= 3600) {
            clearInterval(stopwatchInterval);
            stopwatchInterval = null;
            showAlertModal('Đã đếm đến 60 phút!');
        }
    }, 1000);
};

window.pauseStopwatch = function () {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
};

window.resetStopwatch = function () {
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

window.closeToolModal = function (e) {
    if (!e || e.target.id === 'toolModalOverlay' || e.target.classList.contains('close-modal-btn')) {
        document.getElementById('toolModalOverlay')?.remove();
    }
};

window.showAlertModal = function (message) {
    document.getElementById('alertModalOverlay')?.remove();
    const modalHTML = `
        <div id="alertModalOverlay" class="modal-overlay" onclick="closeAlertModal(event)">
            <div class="alert-modal-card" onclick="event.stopPropagation()">
                <div class="alert-icon"><i class="fa-solid fa-bell"></i></div>
                <div class="alert-title">${message}</div>
                <button type="button" style="width: 100%; margin-top: 10px;" onclick="closeAlertModal()">Đóng</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeAlertModal = function (e) {
    if (!e || e.target.id === 'alertModalOverlay' || e.target.tagName === 'BUTTON') {
        document.getElementById('alertModalOverlay')?.remove();
    }
};

function closeToolsMenu() {
    const menu = document.querySelector('.tools-menu');
    if (menu) {
        menu.classList.remove('show');
        menu.style.display = '';
    }
}


// ============================================================
// XUẤT FILE DANH SÁCH HỌC SINH (2 sheet gọn: Tóm tắt + Điểm chi tiết)
// ============================================================
function escapeCsvCell(val) {
    const s = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function downloadCsv(filename, headers, rows) {
    const lines = [];
    lines.push(headers.map(escapeCsvCell).join(','));
    rows.forEach(function (row) {
        lines.push(row.map(escapeCsvCell).join(','));
    });
    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadXlsxWorkbook(filename, sheets) {
    // sheets: [{ name, headers, rows }]
    if (typeof XLSX === 'undefined') {
        // Fallback: xuất sheet đầu dạng CSV
        const s0 = sheets[0];
        downloadCsv(filename.replace(/\.xlsx$/i, '.csv'), s0.headers, s0.rows);
        return;
    }
    const wb = XLSX.utils.book_new();
    sheets.forEach(function (sh) {
        const data = [sh.headers].concat(sh.rows);
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Độ rộng cột hợp lý
        const colWidths = sh.headers.map(function (h, ci) {
            let max = String(h || '').length;
            sh.rows.forEach(function (r) {
                const len = String(r[ci] == null ? '' : r[ci]).length;
                if (len > max) max = len;
            });
            // Giới hạn để bảng không quá rộng
            const w = Math.min(Math.max(max + 2, 8), 36);
            return { wch: w };
        });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sh.name.substring(0, 31));
    });
    XLSX.writeFile(wb, filename);
}

window.exportStudentList = async function () {
    if (!currentClassId || !currentUser) {
        return showToast('Vui lòng mở một lớp để xuất danh sách.', 'error');
    }
    if (!currentStudents || !currentStudents.length) {
        return showToast('Lớp chưa có học sinh.', 'error');
    }

    const btn = document.getElementById('btnExportStudents');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xuất...';
    }

    try {
        const isPrimary = isPrimaryGrade(currentClassGrade);
        const subjects = getSubjectsForGrade(currentClassGrade);
        const scoreKeys = getScoreKeysForGrade(currentClassGrade);

        const studentIds = currentStudents.map(function (s) { return s.id; });

        const { data: gradeRows } = await _supabase
            .from('grades')
            .select('*')
            .in('student_id', studentIds);

        const { data: attLogs } = await _supabase
            .from('attendance_logs')
            .select('student_id, is_present')
            .in('student_id', studentIds);

        const gradeMapAll = {};
        (gradeRows || []).forEach(function (r) {
            const sid = String(r.student_id);
            if (!gradeMapAll[sid]) gradeMapAll[sid] = {};
            if (!gradeMapAll[sid][r.subject]) gradeMapAll[sid][r.subject] = {};
            gradeMapAll[sid][r.subject][r.score_key] = r.score_value;
        });

        const attMap = {};
        (attLogs || []).forEach(function (l) {
            const sid = String(l.student_id);
            if (!attMap[sid]) attMap[sid] = { present: 0, absent: 0 };
            if (l.is_present) attMap[sid].present++;
            else attMap[sid].absent++;
        });

        // ===== SHEET 1: Tóm tắt (gọn) — 1 dòng / học sinh =====
        const summaryHeaders = isPrimary
            ? ['STT', 'Họ tên', 'SĐT', 'Có mặt', 'Vắng', 'Điểm thi đua', 'Mức HT (AI)', 'Chuyên cần (AI)', 'Thái độ (AI)', 'Nhận xét tổng quát (AI)']
            : ['STT', 'Họ tên', 'SĐT', 'Có mặt', 'Vắng', 'Điểm thi đua', 'Học lực (AI)', 'Chuyên cần (AI)', 'Thái độ (AI)', 'Nhận xét tổng quát (AI)'];

        const summaryRows = currentStudents.map(function (st) {
            const sid = String(st.id);
            const gmap = gradeMapAll[sid] || {};
            const att = attMap[sid] || { present: 0, absent: 0 };
            const ai = generateAIEvaluation(st, gmap, att.present, att.absent);
            const summaryText = (ai.summary || '').replace(/<[^>]+>/g, '');
            const points = Number(st.points) || 0;

            if (isPrimary) {
                return [
                    st.student_number || '',
                    st.name || '',
                    st.phone || '',
                    att.present,
                    att.absent,
                    points,
                    ai.completeLabel || '',
                    ai.attendComment || '',
                    ai.behaviorComment || '',
                    summaryText
                ];
            }
            return [
                st.student_number || '',
                st.name || '',
                st.phone || '',
                att.present,
                att.absent,
                points,
                ai.academicComment || '',
                ai.attendComment || '',
                ai.behaviorComment || '',
                summaryText
            ];
        });

        // ===== SHEET 2: Điểm chi tiết — 1 dòng / (học sinh × môn) =====
        const detailHeaders = ['STT', 'Họ tên', 'Môn'];
        scoreKeys.forEach(function (sk) {
            detailHeaders.push(sk.label);
        });
        if (isPrimary) {
            detailHeaders.push('Mức hoàn thành');
        } else {
            detailHeaders.push('ĐTB HK1', 'ĐTB HK2', 'ĐTB cả năm');
        }

        const detailRows = [];
        currentStudents.forEach(function (st) {
            const sid = String(st.id);
            const gmap = gradeMapAll[sid] || {};
            subjects.forEach(function (sub) {
                const scores = gmap[sub] || {};
                const row = [
                    st.student_number || '',
                    st.name || '',
                    sub
                ];
                scoreKeys.forEach(function (sk) {
                    row.push(scores[sk.key] != null && scores[sk.key] !== '' ? scores[sk.key] : '');
                });
                if (isPrimary) {
                    row.push(scores['muc_hoan_thanh'] || '');
                } else {
                    row.push(scores['dtb_hk1'] || '');
                    row.push(scores['dtb_hk2'] || '');
                    row.push(scores['dtb_cn'] || '');
                }
                detailRows.push(row);
            });
        });

        const cap = isPrimary ? 'Cap1' : 'Cap2';
        const safeName = (currentClassName || 'Lop').replace(/[\\/:*?"<>|]/g, '_');
        const dateStr = getTodayString();
        const filename = 'DanhSach_' + safeName + '_Khoi' + currentClassGrade + '_' + cap + '_' + dateStr + '.xlsx';

        downloadXlsxWorkbook(filename, [
            { name: 'TomTat', headers: summaryHeaders, rows: summaryRows },
            { name: 'DiemChiTiet', headers: detailHeaders, rows: detailRows }
        ]);

        showToast('Đã xuất file Excel thành công: ' + filename, 'success');
    } catch (e) {
        console.error(e);
        showToast('Lỗi khi xuất file: ' + (e.message || e), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Xuất file';
        }
    }
};

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (typeof loadAppearanceSettings === 'function') loadAppearanceSettings();
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    const { data: { session } } = await _supabase.auth.getSession();
    applyUserSession(session?.user || null);

    _supabase.auth.onAuthStateChange((event, session) => {
        applyUserSession(session?.user || null);
    });

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

    const toolsBtn = document.querySelector('.tools-btn');
    const toolsMenu = document.querySelector('.tools-menu');

    if (toolsBtn && toolsMenu) {
        toolsBtn.onclick = (e) => {
            e.stopPropagation();
            toolsMenu.classList.toggle('show');
        };
    }

    window.onclick = (e) => {
        const userDropdown = document.getElementById('userDropdown');
        const userMenu = document.getElementById('userMenu') || document.querySelector('.user-menu');
        const notificationWrap = document.querySelector('.notification-wrap');
        if (userDropdown && (!userMenu || !userMenu.contains(e.target))) userDropdown.classList.remove('show');
        if (notificationWrap && !notificationWrap.contains(e.target)) closeNotificationPanel();
        const container = document.querySelector('.dropdown-tools');
        if (container && !container.contains(e.target)) {
            closeToolsMenu();
        }
    };

    const clickAction = (id, func) => { const el = document.getElementById(id); if (el) el.onclick = func; };

    clickAction('btnLogin', async () => {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (!email || !email.includes('@')) return showToast('Vui lòng nhập email hợp lệ.', 'error');
        if (password.length < 6) return showToast('Mật khẩu phải có ít nhất 6 ký tự.', 'error');
        const { error } = await _supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) showToast('Đăng nhập không thành công: ' + error.message, 'error'); else window.location.href = 'class.html';
    });

    clickAction('btnRegister', async () => {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        if (!email || !email.includes('@')) return showToast('Vui lòng nhập email hợp lệ.', 'error');
        if (password.length < 6) return showToast('Mật khẩu phải có ít nhất 6 ký tự.', 'error');
        if (password !== confirmPassword) return showToast('Mật khẩu xác nhận không khớp.', 'error');
        const { error } = await _supabase.auth.signUp({
            email,
            password: password
        });
        if (error) showToast('Đăng ký không thành công: ' + error.message, 'error'); else showToast('Đăng ký thành công!', 'success');
    });

    clickAction('btnLogout', async () => {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    clickAction('btnAddClass', async () => {
        const name = document.getElementById('className').value.trim();
        const gradeEl = document.getElementById('classGrade');
        const grade = parseInt(gradeEl?.value, 10) || 1;
        if (!name) return showToast('Vui lòng nhập tên lớp.', 'error');
        if (!currentUser) return showToast('Vui lòng đăng nhập.', 'error');
        if (grade < 1 || grade > 9) return showToast('Khối lớp phải từ 1 đến 9.', 'error');

        const btn = document.getElementById('btnAddClass');
        if (btn) { btn.disabled = true; btn.innerText = 'Đang tạo...'; }

        let { error } = await _supabase.from('classes').insert([{ name, user_id: currentUser.id, grade_level: grade }]);

        if (error && (error.message || '').toLowerCase().includes('grade_level')) {
            const retry = await _supabase.from('classes').insert([{ name, user_id: currentUser.id }]);
            error = retry.error;
            if (!error) showToast('Đã tạo lớp. Hãy cập nhật cột grade_level trong SQL khi thuận tiện.', 'success');
        }

        if (btn) { btn.disabled = false; btn.innerText = 'Tạo'; }

        if (error) {
            showToast('Lỗi tạo lớp: ' + error.message, 'error');
            return;
        }

        document.getElementById('className').value = '';
        if (gradeEl) gradeEl.value = '1';
        loadClasses();
    });

    // Cập nhật hàm Thêm Học Sinh có xử lý lưu SĐT
    clickAction('btnAddStudent', async () => {
        const name = document.getElementById('stName').value.trim();
        const rawNumber = document.getElementById('stNumber').value.trim();
        const phone = document.getElementById('stPhone')?.value.trim() || null;

        if (!name || !rawNumber) return showToast('Vui lòng nhập đủ tên và STT.', 'error');

        const numberToSave = parseInt(rawNumber, 10) || rawNumber;
        const today = getTodayString();

        let insertRes = await _supabase.from('students').insert([{
            name,
            student_number: numberToSave,
            class_id: currentClassId,
            points: 0,
            is_present: false,
            attendance_date: today,
            phone: phone
        }]).select('id').single();

        let error = insertRes.error;
        let newStudentId = insertRes.data?.id;

        if (error && (error.message || '').includes('points')) {
            const retry = await _supabase.from('students').insert([{
                name,
                student_number: numberToSave,
                class_id: currentClassId,
                is_present: false,
                attendance_date: today,
                phone: phone
            }]).select('id').single();
            error = retry.error;
            newStudentId = retry.data?.id;
        }

        if (error) {
            showToast(error.message, 'error');
            return;
        }

        if (newStudentId) {
            try {
                await _supabase.from('attendance_logs').upsert({
                    student_id: newStudentId,
                    attendance_date: today,
                    is_present: false
                }, { onConflict: 'student_id,attendance_date' });
            } catch (e) { console.warn('attendance_logs on add student:', e); }
        }

        document.getElementById('stName').value = '';
        document.getElementById('stNumber').value = '';
        if (document.getElementById('stPhone')) document.getElementById('stPhone').value = '';
        loadStudents();
    });

    clickAction('btnRandom', () => {
        if (!currentStudents.length) return showToast('Lớp đang trống.', 'error');
        if (isRandomizing) return;

        isRandomizing = true;
        const resultEl = document.getElementById('random-result');
        const finalStudent = currentStudents[Math.floor(Math.random() * currentStudents.length)];

        let speed = 40;
        let totalSteps = 25;
        let currentStep = 0;

        function runRandomStep() {
            const tempStudent = currentStudents[Math.floor(Math.random() * currentStudents.length)];
            resultEl.innerHTML = `
                <div style="font-size:0.9rem; font-weight:400; color:var(--text-sub)">Đang quay số...</div>
                <div style="font-size:2.8rem; font-weight:800; color:var(--primary)">#${tempStudent.student_number}</div>
            `;

            currentStep++;
            if (currentStep < totalSteps) {
                speed += 12;
                setTimeout(runRandomStep, speed);
            } else {
                resultEl.innerHTML = `
                    <div style="font-size:0.9rem; font-weight:400; color:var(--text-sub)">Số may mắn là:</div>
                    <div style="font-size:2.8rem; font-weight:800; color:#10b981">#${finalStudent.student_number}</div>
                    <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-top:2px">${finalStudent.name}</div>
                `;
                isRandomizing = false;
            }
        }

        runRandomStep();
    });

    clickAction('btnSaveSchool', () => saveSchedule('school'));
    clickAction('btnExportStudents', () => exportStudentList());
    clickAction('btnSaveExtra', () => saveSchedule('extra'));
});
// --- KHỞI TẠO BIẾN TOÀN CỤC ---
window._gbCache = null;


// ============================================================
// AI TỰ ĐỘNG ĐÁNH GIÁ HỌC SINH
// - Cấp 1: theo mức Hoàn thành tốt / Hoàn thành / Chưa hoàn thành (TT 27/2020)
// - Cấp 2: theo học lực + chuyên cần + điểm thi đua
// ============================================================
function generateAIEvaluation(student, gradeMap, presentCount, absentCount) {
    const points = Number(student.points) || 0;
    const totalDays = presentCount + absentCount;
    const attendRate = totalDays > 0 ? (presentCount / totalDays) * 100 : null;
    const isPrimary = isPrimaryGrade(currentClassGrade);

    // Điểm kiểm tra định kỳ (Cấp 1: gk1, ck1, gk2, ck2) — bỏ comment & dtb_
    const periodicKeys = isPrimary
        ? ['gk1', 'ck1', 'gk2', 'ck2']
        : ['mieng', 'tx1', 'tx2', 'tx3', 'gk1', 'ck1', 'gk2', 'ck2'];

    const allScores = [];
    Object.keys(gradeMap || {}).forEach(function (sub) {
        const scores = gradeMap[sub] || {};
        periodicKeys.forEach(function (k) {
            const v = parseScore(scores[k]);
            if (v !== null && v >= 0 && v <= 10) allScores.push(v);
        });
    });

    let avgScore = null;
    if (allScores.length > 0) {
        avgScore = round1(allScores.reduce(function (a, b) { return a + b; }, 0) / allScores.length);
    }

    // --- Chuyên cần (dùng chung) ---
    let attendComment = '';
    let attendLevel = 'trung bình';
    if (totalDays === 0) {
        attendComment = 'Chưa có dữ liệu điểm danh.';
    } else if (attendRate >= 95) {
        attendComment = 'Chuyên cần rất tốt (' + presentCount + '/' + totalDays + ' buổi, tỷ lệ ' + attendRate.toFixed(0) + '%).';
        attendLevel = 'xuất sắc';
    } else if (attendRate >= 85) {
        attendComment = 'Chuyên cần tốt (' + presentCount + '/' + totalDays + ' buổi, tỷ lệ ' + attendRate.toFixed(0) + '%).';
        attendLevel = 'tốt';
    } else if (attendRate >= 70) {
        attendComment = 'Chuyên cần ở mức trung bình (' + presentCount + '/' + totalDays + ' buổi, vắng ' + absentCount + ' buổi). Cần cải thiện.';
        attendLevel = 'trung bình';
    } else {
        attendComment = 'Chuyên cần yếu (vắng ' + absentCount + '/' + totalDays + ' buổi, tỷ lệ có mặt chỉ ' + attendRate.toFixed(0) + '%). Cần nhắc nhở nghiêm túc.';
        attendLevel = 'yếu';
    }

    // --- Thái độ / điểm thi đua (dùng chung) ---
    let behaviorComment = '';
    let behaviorLevel = 'trung bình';
    if (points >= 15) {
        behaviorComment = 'Thái độ học tập và ý thức rất tích cực (điểm thi đua +' + points + '). Là tấm gương tốt cho lớp.';
        behaviorLevel = 'xuất sắc';
    } else if (points >= 5) {
        behaviorComment = 'Thái độ học tập tốt, có nhiều lần được cộng điểm (+' + points + ').';
        behaviorLevel = 'tốt';
    } else if (points > 0) {
        behaviorComment = 'Có cố gắng trong học tập và sinh hoạt (điểm thi đua +' + points + ').';
        behaviorLevel = 'khá';
    } else if (points === 0) {
        behaviorComment = 'Điểm thi đua đang ở mức 0. Cần khuyến khích tham gia tích cực hơn.';
        behaviorLevel = 'trung bình';
    } else if (points > -10) {
        behaviorComment = 'Có một số lần bị trừ điểm (tổng ' + points + '). Cần nhắc nhở về ý thức và kỷ luật.';
        behaviorLevel = 'cần cố gắng';
    } else {
        behaviorComment = 'Điểm thi đua đang âm nhiều (' + points + '). Cần quan tâm, hỗ trợ và nhắc nhở nghiêm túc về thái độ.';
        behaviorLevel = 'yếu';
    }

    // ========== CẤP 1: Mức hoàn thành theo bảng quy định ==========
    // Hoàn thành tốt: 9.0 – 10
    // Hoàn thành:     5.0 – 8.0
    // Chưa hoàn thành: dưới 5.0
    if (isPrimary) {
        let completeLevel = null; // 'tot' | 'hoanthanh' | 'chua'
        let completeLabel = '';
        let completeDesc = '';
        let completeClass = '';

        if (avgScore === null) {
            completeLabel = 'Chưa đủ dữ liệu';
            completeDesc = 'Chưa có điểm kiểm tra định kỳ (Giữa kì / Cuối kì) để đánh giá mức hoàn thành.';
            completeClass = 'pending';
        } else if (avgScore >= 9.0) {
            completeLevel = 'tot';
            completeLabel = 'Hoàn thành tốt';
            completeDesc = 'Học sinh thực hiện tốt các yêu cầu học tập của môn học, bài kiểm tra định kỳ đạt từ 9.0 – 10 điểm (TB ≈ ' + avgScore.toFixed(1) + ').';
            completeClass = 'tot';
        } else if (avgScore >= 5.0) {
            completeLevel = 'hoanthanh';
            completeLabel = 'Hoàn thành';
            completeDesc = 'Học sinh thực hiện được các yêu cầu học tập của môn học, bài kiểm tra định kỳ đạt từ 5.0 – 8.0 điểm (TB ≈ ' + avgScore.toFixed(1) + ').';
            completeClass = 'hoanthanh';
        } else {
            completeLevel = 'chua';
            completeLabel = 'Chưa hoàn thành';
            completeDesc = 'Học sinh chưa thực hiện được các yêu cầu học tập, bài kiểm tra định kỳ dưới 5.0 điểm (TB ≈ ' + avgScore.toFixed(1) + '). Sẽ được giáo viên hướng dẫn, hỗ trợ học lại để kiểm tra bổ sung.';
            completeClass = 'chua';
        }

        // Tổng hợp cấp 1: ưu tiên mức hoàn thành, kết hợp chuyên cần & thái độ
        let summary = '';
        if (completeLevel === 'tot') {
            summary = 'Nhận xét tổng quát: <b>Hoàn thành tốt</b>. ';
            if (attendLevel === 'yếu' || behaviorLevel === 'yếu') {
                summary += 'Học lực tốt nhưng cần chú ý thêm chuyên cần / thái độ.';
            } else {
                summary += 'Nên tiếp tục duy trì và phát huy.';
            }
        } else if (completeLevel === 'hoanthanh') {
            summary = 'Nhận xét tổng quát: <b>Hoàn thành</b>. ';
            summary += 'Cần động viên để phấn đấu lên mức Hoàn thành tốt.';
        } else if (completeLevel === 'chua') {
            summary = 'Nhận xét tổng quát: <b>Chưa hoàn thành</b>. ';
            summary += 'Đề nghị giáo viên hướng dẫn, hỗ trợ học lại và kiểm tra bổ sung. Phối hợp gia đình theo dõi.';
        } else {
            summary = 'Nhận xét tổng quát: Chưa đủ điểm kiểm tra định kỳ để xếp mức hoàn thành. Hãy nhập điểm Giữa kì / Cuối kì.';
        }

        return {
            isPrimary: true,
            attendComment: attendComment,
            behaviorComment: behaviorComment,
            academicComment: completeDesc,
            completeLabel: completeLabel,
            completeClass: completeClass,
            completeLevel: completeLevel,
            summary: summary,
            avgScore: avgScore,
            attendRate: attendRate,
            points: points,
            presentCount: presentCount,
            absentCount: absentCount
        };
    }

    // ========== CẤP 2: Học lực theo thang điểm ==========
    let academicComment = '';
    let academicLevel = 'chưa có dữ liệu';
    if (avgScore === null) {
        academicComment = 'Chưa có đủ điểm kiểm tra để đánh giá học lực.';
    } else if (avgScore >= 9) {
        academicComment = 'Học lực xuất sắc (điểm TB các bài kiểm tra ≈ ' + avgScore.toFixed(1) + ').';
        academicLevel = 'xuất sắc';
    } else if (avgScore >= 8) {
        academicComment = 'Học lực giỏi (điểm TB các bài kiểm tra ≈ ' + avgScore.toFixed(1) + ').';
        academicLevel = 'giỏi';
    } else if (avgScore >= 6.5) {
        academicComment = 'Học lực khá (điểm TB các bài kiểm tra ≈ ' + avgScore.toFixed(1) + ').';
        academicLevel = 'khá';
    } else if (avgScore >= 5) {
        academicComment = 'Học lực trung bình (điểm TB các bài kiểm tra ≈ ' + avgScore.toFixed(1) + '). Cần ôn tập thêm.';
        academicLevel = 'trung bình';
    } else {
        academicComment = 'Học lực còn yếu (điểm TB các bài kiểm tra ≈ ' + avgScore.toFixed(1) + '). Cần hỗ trợ và kèm cặp thêm.';
        academicLevel = 'yếu';
    }

    const levels = [attendLevel, behaviorLevel, academicLevel];
    let overall = 'cần cố gắng';
    if (levels.filter(function (l) { return l === 'xuất sắc' || l === 'giỏi' || l === 'tốt'; }).length >= 2 && !levels.includes('yếu')) {
        overall = 'xuất sắc / tốt';
    } else if (levels.includes('yếu') || levels.filter(function (l) { return l === 'cần cố gắng' || l === 'yếu'; }).length >= 2) {
        overall = 'cần quan tâm đặc biệt';
    } else if (levels.includes('trung bình') || levels.includes('khá')) {
        overall = 'ổn định, có tiềm năng';
    }

    let summary = 'Nhận xét tổng quát: Học sinh đang ở mức <b>' + overall + '</b>. ';
    if (overall.indexOf('xuất sắc') >= 0 || overall.indexOf('tốt') >= 0) {
        summary += 'Nên tiếp tục duy trì và phát huy.';
    } else if (overall.indexOf('quan tâm') >= 0) {
        summary += 'Đề nghị gia đình và giáo viên phối hợp hỗ trợ nhiều hơn.';
    } else {
        summary += 'Cần động viên và theo dõi thêm trong thời gian tới.';
    }

    return {
        isPrimary: false,
        attendComment: attendComment,
        behaviorComment: behaviorComment,
        academicComment: academicComment,
        summary: summary,
        avgScore: avgScore,
        attendRate: attendRate,
        points: points,
        presentCount: presentCount,
        absentCount: absentCount
    };
}

function buildAIEvaluationHTML(evalData) {
    if (!evalData) return '';

    // ===== Giao diện CẤP 1: ô mức hoàn thành theo bảng =====
    if (evalData.isPrimary) {
        const badgeClass = evalData.completeClass || 'pending';
        return (
            '<div class="gb-ai-section">' +
            '  <div class="gb-section-label"><i class="fa-solid fa-robot"></i> Đánh giá AI tự động (Cấp 1)</div>' +
            '  <div class="gb-ai-card">' +
            '    <div class="gb-complete-badge gb-complete-' + badgeClass + '">' +
            '      <span class="gb-complete-icon"><i class="fa-solid fa-award"></i></span>' +
            '      <div>' +
            '        <div class="gb-complete-label">' + (evalData.completeLabel || '—') + '</div>' +
            '        <div class="gb-complete-desc">' + (evalData.academicComment || '') + '</div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="gb-ai-row">' +
            '      <span class="gb-ai-icon"><i class="fa-solid fa-user-check"></i></span>' +
            '      <div class="gb-ai-content">' +
            '        <div class="gb-ai-title">Chuyên cần</div>' +
            '        <div class="gb-ai-text">' + evalData.attendComment + '</div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="gb-ai-row">' +
            '      <span class="gb-ai-icon"><i class="fa-solid fa-star"></i></span>' +
            '      <div class="gb-ai-content">' +
            '        <div class="gb-ai-title">Thái độ &amp; Điểm thi đua</div>' +
            '        <div class="gb-ai-text">' + evalData.behaviorComment + '</div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="gb-ai-summary">' + evalData.summary + '</div>' +
            '    <div class="gb-ai-hint"><i class="fa-solid fa-circle-info"></i> Cấp 1: Hoàn thành tốt (9.0–10) · Hoàn thành (5.0–8.0) · Chưa hoàn thành (&lt;5.0). Dựa trên điểm kiểm tra định kỳ, chuyên cần &amp; điểm thi đua. Chỉ mang tính tham khảo.</div>' +
            '  </div>' +
            '</div>'
        );
    }

    // ===== Giao diện CẤP 2 =====
    return (
        '<div class="gb-ai-section">' +
        '  <div class="gb-section-label"><i class="fa-solid fa-robot"></i> Đánh giá AI tự động</div>' +
        '  <div class="gb-ai-card">' +
        '    <div class="gb-ai-row">' +
        '      <span class="gb-ai-icon"><i class="fa-solid fa-user-check"></i></span>' +
        '      <div class="gb-ai-content">' +
        '        <div class="gb-ai-title">Chuyên cần</div>' +
        '        <div class="gb-ai-text">' + evalData.attendComment + '</div>' +
        '      </div>' +
        '    </div>' +
        '    <div class="gb-ai-row">' +
        '      <span class="gb-ai-icon"><i class="fa-solid fa-star"></i></span>' +
        '      <div class="gb-ai-content">' +
        '        <div class="gb-ai-title">Thái độ &amp; Điểm thi đua</div>' +
        '        <div class="gb-ai-text">' + evalData.behaviorComment + '</div>' +
        '      </div>' +
        '    </div>' +
        '    <div class="gb-ai-row">' +
        '      <span class="gb-ai-icon"><i class="fa-solid fa-book"></i></span>' +
        '      <div class="gb-ai-content">' +
        '        <div class="gb-ai-title">Học lực (điểm kiểm tra)</div>' +
        '        <div class="gb-ai-text">' + evalData.academicComment + '</div>' +
        '      </div>' +
        '    </div>' +
        '    <div class="gb-ai-summary">' + evalData.summary + '</div>' +
        '    <div class="gb-ai-hint"><i class="fa-solid fa-circle-info"></i> Đánh giá dựa trên: điểm cộng/trừ, điểm các bài kiểm tra đã nhập, số buổi có mặt &amp; vắng. Chỉ mang tính tham khảo.</div>' +
        '  </div>' +
        '</div>'
    );
}

// --- HÀM MỞ HỌC BẠ (CÓ NÚT & FORM CHỈNH SỬA Ở ĐẦU + AI ĐÁNH GIÁ) ---
window.openGradebook = async (studentId) => {
    const student = currentStudents.find(s => String(s.id) === String(studentId));
    if (!student) return;

    document.getElementById('gradebookOverlay')?.remove();

    let gradeMap = {};
    try {
        const { data: gradeRows } = await _supabase
            .from('grades')
            .select('*')
            .eq('student_id', studentId);
        (gradeRows || []).forEach(r => {
            if (!gradeMap[r.subject]) gradeMap[r.subject] = {};
            gradeMap[r.subject][r.score_key] = r.score_value;
        });
    } catch (e) { 
        console.warn('Lỗi lấy điểm:', e); 
    }

    let presentCount = 0;
    let absentCount = 0;
    try {
        const { data: logs } = await _supabase
            .from('attendance_logs')
            .select('is_present')
            .eq('student_id', studentId);
        (logs || []).forEach(l => {
            if (l.is_present) presentCount++;
            else absentCount++;
        });
    } catch (e) { 
        console.warn('Lỗi lấy điểm danh:', e); 
    }

    window._gbCache = {
        studentId: String(studentId),
        student: student,
        gradeMap: gradeMap,
        presentCount: presentCount,
        absentCount: absentCount
    };

    const subjects = getSubjectsForGrade(currentClassGrade);
    const isPrimary = isPrimaryGrade(currentClassGrade);

    // --- AI ĐÁNH GIÁ ---
    const aiEval = generateAIEvaluation(student, gradeMap, presentCount, absentCount);
    const aiHTML = buildAIEvaluationHTML(aiEval);

    let subjectBtns = '';
    subjects.forEach((sub, i) => {
        let badgeHtml = '';
        if (isPrimary) {
            const subScores = gradeMap[sub] || {};
            // Ưu tiên mức đã lưu; không có thì tính tạm từ điểm
            let muc = subScores['muc_hoan_thanh'] || '';
            let css = 'pending';
            if (!muc) {
                const c = calcPrimaryCompletion(subScores);
                muc = c.level ? c.label : '';
                css = c.css;
            } else if (muc.indexOf('tốt') >= 0) {
                css = 'tot';
            } else if (muc === 'Hoàn thành') {
                css = 'hoanthanh';
            } else if (muc.indexOf('Chưa') >= 0) {
                css = 'chua';
            }
            if (muc) {
                badgeHtml = '<span class="gb-sub-badge gb-sub-badge-' + css + '">' + muc + '</span>';
            }
        }
        subjectBtns +=
            '<button type="button" class="gb-subject-btn" data-subject-idx="' + i + '">' +
            '<span class="gb-sub-icon"><i class="fa-solid fa-book-open-reader"></i></span>' +
            '<span class="gb-sub-name">' + sub + badgeHtml + '</span>' +
            '<span class="gb-sub-arrow"><i class="fa-solid fa-chevron-right"></i></span>' +
            '</button>';
    });

    const modalHTML =
        '<div id="gradebookOverlay" class="modal-overlay">' +
        '  <div class="gradebook-modal gb-list-modal" onclick="event.stopPropagation()">' +
        '    <button type="button" class="close-modal-btn" id="gbCloseBtn"><i class="fa-solid fa-xmark"></i></button>' +
        
        '    <!-- HEADER HỌC BẠ (CÓ TÍNH NĂNG CHỈNH SỬA) -->' +
        '    <div class="gb-header">' +
        '      <div style="flex: 1;">' +

        '        <!-- CHẾ ĐỘ HIỂN THỊ -->' +
        '        <div id="gb-view-info">' +
        '          <div style="display:flex; align-items:center; gap:8px;">' +
        '            <div class="gb-st-num">#' + (student.student_number || '') + '</div>' +
        '            <button type="button" class="btn-edit-st" onclick="toggleEditStudentInfo(true)"><i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa</button>' +
        '          </div>' +
        '          <h2 class="gb-st-name"></h2>' +
        '          <div class="gb-meta"></div>' +
        '          <div class="gb-phone" style="font-size:0.85rem; color:var(--text-sub); margin-top:4px;">' +
        '             <i class="fa-solid fa-phone"></i> SĐT: <b>' + (student.phone || 'Chưa có') + '</b>' +
        '          </div>' +
        '        </div>' +

        '        <!-- CHẾ ĐỘ CHỈNH SỬA -->' +
        '        <div id="gb-edit-info" style="display:none; margin-right: 15px;">' +
        '          <div style="display:grid; grid-template-columns: 80px 1fr; gap:8px; margin-bottom:8px;">' +
        '            <input type="text" id="editStNumber" class="gb-edit-input" value="' + (student.student_number || '') + '" placeholder="STT">' +
        '            <input type="text" id="editStName" class="gb-edit-input" value="' + (student.name || '') + '" placeholder="Tên học sinh">' +
        '          </div>' +
        '          <input type="text" id="editStPhone" class="gb-edit-input" value="' + (student.phone || '') + '" placeholder="Số điện thoại" style="margin-bottom:8px; width:100%;">' +
        '          <div style="display:flex; gap:8px;">' +
        '            <button type="button" class="btn-gb-save" onclick="saveStudentInfo(\'' + student.id + '\')"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>' +
        '            <button type="button" class="btn-gb-cancel" onclick="toggleEditStudentInfo(false)"><i class="fa-solid fa-xmark"></i> Hủy</button>' +
        '          </div>' +
        '        </div>' +

        '      </div>' +

        '      <!-- KHU VỰC THỐNG KÊ ĐIỂM DANH -->' +
        '      <div class="gb-attendance-box">' +
        '        <div class="gb-att-item present">' +
        '          <span class="gb-att-num">' + presentCount + '</span>' +
        '          <span class="gb-att-label"><i class="fa-solid fa-user-check"></i> Có mặt</span>' +
        '        </div>' +
        '        <div class="gb-att-item absent">' +
        '          <span class="gb-att-num">' + absentCount + '</span>' +
        '          <span class="gb-att-label"><i class="fa-solid fa-user-xmark"></i> Vắng</span>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +

        '    <div class="gb-scroll-body">' +
        aiHTML +
        '      <div class="gb-section-label"><i class="fa-solid fa-list-check"></i> Chọn môn học</div>' +
        '      <div class="gb-subject-list">' + subjectBtns + '</div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById('gradebookOverlay');
    overlay.querySelector('.gb-st-name').textContent = student.name || '';
    overlay.querySelector('.gb-meta').textContent =
        (currentClassName || '') + ' · Khối ' + currentClassGrade + ' · ' + (isPrimary ? 'Cấp 1' : 'Cấp 2');

    overlay.addEventListener('click', function (e) {
        if (e.target.id === 'gradebookOverlay') closeGradebook();
    });
    document.getElementById('gbCloseBtn').addEventListener('click', closeGradebook);

    overlay.querySelectorAll('.gb-subject-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const idx = parseInt(btn.getAttribute('data-subject-idx'), 10);
            openSubjectScores(subjects[idx]);
        });
    });
};

// --- CHUYỂN ĐỔI BẬT/TẮT FORM CHỈNH SỬA ---
window.toggleEditStudentInfo = function (isEditing) {
    const viewDiv = document.getElementById('gb-view-info');
    const editDiv = document.getElementById('gb-edit-info');
    if (viewDiv && editDiv) {
        viewDiv.style.display = isEditing ? 'none' : 'block';
        editDiv.style.display = isEditing ? 'block' : 'none';
    }
};

// --- LƯU THÔNG TIN HỌC SINH VÀO SUPABASE ---
window.saveStudentInfo = async function (studentId) {
    const newName = document.getElementById('editStName')?.value.trim();
    const newNumber = document.getElementById('editStNumber')?.value.trim();
    const newPhone = document.getElementById('editStPhone')?.value.trim() || null;

    if (!newName || !newNumber) {
        showToast('Vui lòng nhập đầy đủ tên và STT!', 'error');
        return;
    }

    const numberToSave = parseInt(newNumber, 10) || newNumber;

    try {
        const { error } = await _supabase
            .from('students')
            .update({
                name: newName,
                student_number: numberToSave,
                phone: newPhone
            })
            .eq('id', studentId);

        if (error) {
            showToast('Lỗi cập nhật: ' + error.message, 'error');
            return;
        }

        showToast('Cập nhật thông tin học sinh thành công!', 'success');
        closeGradebook();
        if (typeof loadStudents === 'function') {
            loadStudents(); // Load lại danh sách bên ngoài trang chính
        }
    } catch (err) {
        console.error('Lỗi lưu thông tin:', err);
        showToast('Có lỗi xảy ra khi lưu dữ liệu!', 'error');
    }
};

// --- HÀM ĐÓNG HỌC BẠ ---
window.closeGradebook = function () {
    document.getElementById('subjectScoreOverlay')?.remove();
    const modal = document.getElementById('gradebookOverlay');
    if (modal) modal.remove();
    window._gbCache = null;
};

// ============================================================
// CÀI ĐẶT: GIAO DIỆN + TÀI KHOẢN
// ============================================================

const PRIMARY_PRESETS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function darkenHex(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    const f = 1 - amount;
    const toHex = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function applyPrimaryColor(hex) {
    if (!hex || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) return;
    document.documentElement.style.setProperty('--primary', hex);
    document.documentElement.style.setProperty('--primary-hover', darkenHex(hex, 0.12));
    localStorage.setItem('primaryColor', hex);
    document.querySelectorAll('.color-swatch').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-color') === hex);
    });
    const custom = document.getElementById('customPrimary');
    if (custom) custom.value = hex;
}

function applyFontSize(size) {
    document.documentElement.setAttribute('data-font', size === 'large' ? 'large' : 'normal');
    localStorage.setItem('fontSize', size === 'large' ? 'large' : 'normal');
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-size') === size);
    });
}

function loadAppearanceSettings() {
    const savedColor = localStorage.getItem('primaryColor') || '#6366f1';
    applyPrimaryColor(savedColor);
    const fontSize = localStorage.getItem('fontSize') || 'normal';
    applyFontSize(fontSize);
}

// Cập nhật applyUserSession để hiện link Cài đặt + bảo vệ trang settings
const _origApplyUserSession = applyUserSession;
applyUserSession = function (user) {
    _origApplyUserSession(user);
    document.querySelectorAll('.nav-settings-link').forEach(el => {
        el.style.display = user ? '' : 'none';
    });
    if (window.location.pathname.includes('settings.html')) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        initSettingsPage();
    }
};

function initSettingsPage() {
    if (!window.location.pathname.includes('settings.html')) return;

    // Sidebar navigation
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.addEventListener('click', function () {
            const panel = btn.getAttribute('data-panel');
            document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            const target = document.getElementById('panel-' + panel);
            if (target) target.classList.add('active');
        });
    });

    // Email
    const emailEl = document.getElementById('settingsEmail');
    if (emailEl && currentUser) emailEl.textContent = currentUser.email || '—';

    // Theme options highlight
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    document.getElementById('themeOptLight')?.classList.toggle('active', theme === 'light');
    document.getElementById('themeOptDark')?.classList.toggle('active', theme === 'dark');

    document.querySelectorAll('[data-theme-set]').forEach(btn => {
        btn.onclick = () => {
            const t = btn.getAttribute('data-theme-set');
            document.documentElement.setAttribute('data-theme', t);
            localStorage.setItem('theme', t);
            updateThemeUI(t);
            document.getElementById('themeOptLight')?.classList.toggle('active', t === 'light');
            document.getElementById('themeOptDark')?.classList.toggle('active', t === 'dark');
            showToast('Đã chuyển sang chế độ ' + (t === 'light' ? 'sáng' : 'tối'), 'success');
        };
    });

    // Color presets
    document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            applyPrimaryColor(sw.getAttribute('data-color'));
            showToast('Đã đổi màu giao diện.', 'success');
        });
    });
    document.getElementById('btnApplyCustomColor')?.addEventListener('click', () => {
        const v = document.getElementById('customPrimary')?.value;
        if (v) {
            applyPrimaryColor(v);
            showToast('Đã áp dụng màu giao diện.', 'success');
        }
    });

    // Font size
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.addEventListener('click', () => applyFontSize(btn.getAttribute('data-size')));
    });
    loadAppearanceSettings();

    // Account actions
    document.getElementById('btnUpdateEmail')?.addEventListener('click', async () => {
        const email = document.getElementById('newEmailInput')?.value.trim();
        if (!email || !email.includes('@')) return showToast('Vui lòng nhập email hợp lệ.', 'error');
        try {
            const { error } = await _supabase.auth.updateUser({ email });
            if (error) return showToast('Lỗi: ' + error.message, 'error');
            showToast('Đã gửi yêu cầu cập nhật email. Hãy kiểm tra hộp thư.', 'success');
            document.getElementById('newEmailInput').value = '';
        } catch (e) {
            showToast('Có lỗi xảy ra: ' + (e.message || e), 'error');
        }
    });

    document.getElementById('btnChangePassword')?.addEventListener('click', async () => {
        const oldPassword = document.getElementById('oldPassword')?.value || '';
        const p1 = document.getElementById('newPassword')?.value || '';
        const p2 = document.getElementById('confirmNewPassword')?.value || '';
        if (!oldPassword) return showToast('Vui lòng nhập mật khẩu cũ.', 'error');
        if (p1.length < 6) return showToast('Mật khẩu tối thiểu 6 ký tự.', 'error');
        if (p1 !== p2) return showToast('Hai mật khẩu không khớp.', 'error');
        try {
            const { error: verifyError } = await _supabase.auth.signInWithPassword({
                email: currentUser?.email || '',
                password: oldPassword
            });
            if (verifyError) return showToast('Mật khẩu cũ không chính xác.', 'error');

            const { error } = await _supabase.auth.updateUser({ password: p1 });
            if (error) return showToast('Lỗi: ' + error.message, 'error');
            showToast('Đổi mật khẩu thành công!', 'success');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
        } catch (e) {
            showToast('Có lỗi xảy ra: ' + (e.message || e), 'error');
        }
    });

    document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
        if (!currentUser) return;
        const ok = confirm('Bạn chắc chắn muốn XÓA TÀI KHOẢN?\n\nToàn bộ lớp, học sinh, điểm, điểm danh, lịch và tài khoản đăng nhập sẽ bị xóa vĩnh viễn trên Supabase.\nHành động không thể hoàn tác.');
        if (!ok) return;
        const confirmText = prompt('Nhập "XOA" (viết hoa) để xác nhận:');
        if (confirmText !== 'XOA') return showToast('Đã hủy.', 'info');

        try {
            const uid = currentUser.id;

            // 1) Xóa dữ liệu app
            await _supabase.from('schedule').delete().eq('user_id', uid);
            const { data: classes } = await _supabase.from('classes').select('id').eq('user_id', uid);
            const classIds = (classes || []).map(c => c.id);
            if (classIds.length) {
                const { data: students } = await _supabase.from('students').select('id').in('class_id', classIds);
                const studentIds = (students || []).map(s => s.id);
                if (studentIds.length) {
                    await _supabase.from('grades').delete().in('student_id', studentIds);
                    await _supabase.from('attendance_logs').delete().in('student_id', studentIds);
                    await _supabase.from('students').delete().in('id', studentIds);
                }
                await _supabase.from('classes').delete().eq('user_id', uid);
            }

            // 2) Gọi Edge Function — URL thực tế trên Dashboard của bạn là /functions/v1/super-action
            let authDeleted = false;
            let edgeMsg = '';
            try {
                const { data: sess } = await _supabase.auth.getSession();
                const accessToken = sess?.session?.access_token;
                if (!accessToken) {
                    edgeMsg = 'Không lấy được access token';
                } else {
                    const res = await fetch(SUPABASE_URL + '/functions/v1/super-action', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + accessToken,
                            'apikey': SUPABASE_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ confirm: true })
                    });
                    const bodyText = await res.text().catch(() => '');
                    if (res.ok) {
                        authDeleted = true;
                    } else {
                        edgeMsg = 'HTTP ' + res.status + ' — ' + bodyText;
                        console.warn('Edge super-action failed:', edgeMsg);
                    }
                }
            } catch (fnErr) {
                edgeMsg = String(fnErr);
                console.warn('Edge function error:', fnErr);
            }

            await _supabase.auth.signOut();

            if (authDeleted) {
                showToast('Đã xóa toàn bộ dữ liệu và tài khoản trên Supabase.', 'success');
            } else {
                showToast('Đã xóa dữ liệu lớp học và đăng xuất. Chưa xóa được tài khoản auth: ' + (edgeMsg || 'không rõ'), 'info');
            }
            window.location.href = 'index.html';
        } catch (e) {
            console.error(e);
            showToast('Lỗi khi xóa dữ liệu: ' + (e.message || e), 'error');
        }
    });

    document.getElementById('btnRefreshStats')?.addEventListener('click', loadSettingsStats);
    document.getElementById('btnClearSchedule')?.addEventListener('click', async () => {
        if (!currentUser) return;
        if (!confirm('Xóa toàn bộ thời khóa biểu (trường + dạy thêm)?')) return;
        try {
            await _supabase.from('schedule').delete().eq('user_id', currentUser.id);
            showToast('Đã xóa toàn bộ TKB.', 'success');
        } catch (e) {
            showToast('Lỗi: ' + (e.message || e), 'error');
        }
    });

    loadSettingsStats();
}

async function loadSettingsStats() {
    if (!currentUser) return;
    try {
        const { data: classes } = await _supabase.from('classes').select('id').eq('user_id', currentUser.id);
        const classIds = (classes || []).map(c => c.id);
        let studentCount = 0;
        if (classIds.length) {
            const { data: st, count } = await _supabase.from('students').select('id', { count: 'exact' }).in('class_id', classIds);
            studentCount = count != null ? count : (st || []).length;
        }
        const elC = document.getElementById('statClasses');
        const elS = document.getElementById('statStudents');
        if (elC) elC.textContent = String(classIds.length);
        if (elS) elS.textContent = String(studentCount);
    } catch (e) {
        console.warn('stats', e);
    }
}

// Load appearance sớm (màu + font) trước khi DOM ready xong
(function earlyAppearance() {
    try {
        const c = localStorage.getItem('primaryColor');
        if (c) {
            document.documentElement.style.setProperty('--primary', c);
            // primary-hover tạm
            document.documentElement.style.setProperty('--primary-hover', c);
        }
        const f = localStorage.getItem('fontSize');
        if (f === 'large') document.documentElement.setAttribute('data-font', 'large');
    } catch (_) {}
})();

// Nếu DOM đã sẵn sàng khi script load xong phần settings
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    try { loadAppearanceSettings(); } catch (_) {}
}
// ============================================================
// THỐNG KÊ THEO LỚP (Chart.js) — stats.html
// ============================================================

let _statsChartScores = null;
let _statsChartPoints = null;
let _statsRefreshTimer = null;
let _statsLoading = false;
let _statsPageInited = false;

function meanOf(arr) {
    if (!arr || !arr.length) return null;
    const sum = arr.reduce(function (a, b) { return a + b; }, 0);
    return round1(sum / arr.length);
}

function computeStudentPeriodAvgs(gradeMap, gradeLevel) {
    const isPrimary = isPrimaryGrade(Number(gradeLevel) || 1);
    const subjects = Object.keys(gradeMap || {});
    if (!subjects.length) {
        return { hk1: null, hk2: null, year: null };
    }

    const hk1List = [];
    const hk2List = [];
    const yearList = [];

    subjects.forEach(function (sub) {
        const scores = gradeMap[sub] || {};

        if (isPrimary) {
            const gk1 = parseScore(scores.gk1);
            const ck1 = parseScore(scores.ck1);
            const gk2 = parseScore(scores.gk2);
            const ck2 = parseScore(scores.ck2);

            const s1 = [];
            if (gk1 !== null) s1.push(gk1);
            if (ck1 !== null) s1.push(ck1);
            const s2 = [];
            if (gk2 !== null) s2.push(gk2);
            if (ck2 !== null) s2.push(ck2);

            if (s1.length) hk1List.push(round1(s1.reduce(function (a, b) { return a + b; }, 0) / s1.length));
            if (s2.length) hk2List.push(round1(s2.reduce(function (a, b) { return a + b; }, 0) / s2.length));

            const all = s1.concat(s2);
            const storedMon = parseScore(scores.dtb_mon);
            if (storedMon !== null) yearList.push(storedMon);
            else if (all.length) yearList.push(round1(all.reduce(function (a, b) { return a + b; }, 0) / all.length));
        } else {
            let d1 = parseScore(scores.dtb_hk1);
            let d2 = parseScore(scores.dtb_hk2);
            let dy = parseScore(scores.dtb_cn);
            if (d1 === null) d1 = calcSemesterAvg(scores, 'gk1', 'ck1');
            if (d2 === null) d2 = calcSemesterAvg(scores, 'gk2', 'ck2');
            if (dy === null) dy = calcYearAvg(d1, d2);
            if (d1 !== null) hk1List.push(d1);
            if (d2 !== null) hk2List.push(d2);
            if (dy !== null) yearList.push(dy);
        }
    });

    return {
        hk1: meanOf(hk1List),
        hk2: meanOf(hk2List),
        year: meanOf(yearList)
    };
}

async function fetchClassStatsData() {
    if (!currentUser) return [];

    const { data: classes, error: cErr } = await _supabase
        .from('classes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name', { ascending: true });

    if (cErr) {
        console.error('stats classes:', cErr);
        return [];
    }
    if (!classes || !classes.length) return [];

    const classIds = classes.map(function (c) { return c.id; });

    const { data: students, error: sErr } = await _supabase
        .from('students')
        .select('id, class_id, name, points, student_number')
        .in('class_id', classIds);

    if (sErr) console.error('stats students:', sErr);

    const studentsByClass = {};
    const allStudentIds = [];
    (students || []).forEach(function (st) {
        const cid = String(st.class_id);
        if (!studentsByClass[cid]) studentsByClass[cid] = [];
        studentsByClass[cid].push(st);
        allStudentIds.push(st.id);
    });

    let gradeRows = [];
    if (allStudentIds.length) {
        const chunkSize = 200;
        for (let i = 0; i < allStudentIds.length; i += chunkSize) {
            const chunk = allStudentIds.slice(i, i + chunkSize);
            const { data, error } = await _supabase
                .from('grades')
                .select('student_id, subject, score_key, score_value')
                .in('student_id', chunk);
            if (error) console.warn('stats grades chunk:', error);
            if (data) gradeRows = gradeRows.concat(data);
        }
    }

    const gradeMapByStudent = {};
    gradeRows.forEach(function (r) {
        const sid = String(r.student_id);
        if (!gradeMapByStudent[sid]) gradeMapByStudent[sid] = {};
        if (!gradeMapByStudent[sid][r.subject]) gradeMapByStudent[sid][r.subject] = {};
        gradeMapByStudent[sid][r.subject][r.score_key] = r.score_value;
    });

    return classes.map(function (cls) {
        const grade = Number(cls.grade_level) || 1;
        const stList = studentsByClass[String(cls.id)] || [];
        const studentHk1 = [];
        const studentHk2 = [];
        const studentYear = [];
        const pointsList = [];

        stList.forEach(function (st) {
            pointsList.push(Number(st.points) || 0);
            const gmap = gradeMapByStudent[String(st.id)] || {};
            const av = computeStudentPeriodAvgs(gmap, grade);
            if (av.hk1 !== null) studentHk1.push(av.hk1);
            if (av.hk2 !== null) studentHk2.push(av.hk2);
            if (av.year !== null) studentYear.push(av.year);
        });

        return {
            id: cls.id,
            name: cls.name || ('Lớp ' + cls.id),
            grade: grade,
            studentCount: stList.length,
            avgHk1: meanOf(studentHk1),
            avgHk2: meanOf(studentHk2),
            avgYear: meanOf(studentYear),
            avgPoints: pointsList.length
                ? round1(pointsList.reduce(function (a, b) { return a + b; }, 0) / pointsList.length)
                : null
        };
    });
}

function chartThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        text: isDark ? '#94a3b8' : '#64748b',
        grid: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)',
        tooltipBg: isDark ? '#1e293b' : '#ffffff',
        tooltipText: isDark ? '#f1f5f9' : '#1e293b',
        border: isDark ? '#334155' : '#e2e8f0'
    };
}

function destroyStatsCharts() {
    if (_statsChartScores) {
        try { _statsChartScores.destroy(); } catch (_) {}
        _statsChartScores = null;
    }
    if (_statsChartPoints) {
        try { _statsChartPoints.destroy(); } catch (_) {}
        _statsChartPoints = null;
    }
}

function renderStatsCharts(rows) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js chưa tải');
        return;
    }

    const canvasScores = document.getElementById('chartScores');
    const canvasPoints = document.getElementById('chartPoints');
    if (!canvasScores || !canvasPoints) return;

    const emptyScores = document.getElementById('statsScoresEmpty');
    const emptyPoints = document.getElementById('statsPointsEmpty');

    destroyStatsCharts();

    if (!rows.length) {
        if (emptyScores) emptyScores.classList.remove('hidden');
        if (emptyPoints) emptyPoints.classList.remove('hidden');
        canvasScores.style.display = 'none';
        canvasPoints.style.display = 'none';
        return;
    }

    if (emptyScores) emptyScores.classList.add('hidden');
    if (emptyPoints) emptyPoints.classList.add('hidden');
    canvasScores.style.display = '';
    canvasPoints.style.display = '';

    const theme = chartThemeColors();
    const shortLabels = rows.map(function (r) {
        const n = r.name || '';
        return n.length > 12 ? (n.slice(0, 11) + '…') : n;
    });

    const hk1Data = rows.map(function (r) { return r.avgHk1; });
    const hk2Data = rows.map(function (r) { return r.avgHk2; });
    const yearData = rows.map(function (r) { return r.avgYear; });
    const pointsData = rows.map(function (r) { return r.avgPoints; });

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: theme.text,
                    boxWidth: 12,
                    padding: 14,
                    font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 11 }
                }
            },
            tooltip: {
                backgroundColor: theme.tooltipBg,
                titleColor: theme.tooltipText,
                bodyColor: theme.tooltipText,
                borderColor: theme.border,
                borderWidth: 1,
                padding: 12,
                titleFont: { weight: '800', size: 13 },
                bodyFont: { size: 12 },
                callbacks: {
                    title: function (items) {
                        if (!items.length) return '';
                        const idx = items[0].dataIndex;
                        const row = rows[idx];
                        return row ? (row.name + ' · Khối ' + row.grade + ' · ' + row.studentCount + ' HS') : '';
                    },
                    label: function (ctx) {
                        const v = ctx.parsed.y;
                        const val = (v === null || v === undefined) ? '—' : Number(v).toFixed(1);
                        return ' ' + ctx.dataset.label + ': ' + val;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: theme.text,
                    maxRotation: 40,
                    minRotation: 0,
                    font: { size: 11, weight: '600' }
                },
                grid: { display: false }
            },
            y: {
                beginAtZero: true,
                ticks: { color: theme.text, font: { size: 11 } },
                grid: { color: theme.grid }
            }
        }
    };

    _statsChartScores = new Chart(canvasScores.getContext('2d'), {
        type: 'bar',
        data: {
            labels: shortLabels,
            datasets: [
                {
                    label: 'ĐTB HK1',
                    data: hk1Data,
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 8,
                    maxBarThickness: 28
                },
                {
                    label: 'ĐTB HK2',
                    data: hk2Data,
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 8,
                    maxBarThickness: 28
                },
                {
                    label: 'ĐTB cả năm',
                    data: yearData,
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1,
                    borderRadius: 8,
                    maxBarThickness: 28
                }
            ]
        },
        options: Object.assign({}, commonOptions, {
            scales: {
                x: commonOptions.scales.x,
                y: Object.assign({}, commonOptions.scales.y, {
                    suggestedMax: 10,
                    max: 10
                })
            }
        })
    });

    const pointColors = pointsData.map(function (v) {
        if (v === null || v === undefined) return 'rgba(148,163,184,0.5)';
        if (v > 0) return 'rgba(16, 185, 129, 0.8)';
        if (v < 0) return 'rgba(239, 68, 68, 0.8)';
        return 'rgba(148, 163, 184, 0.6)';
    });

    _statsChartPoints = new Chart(canvasPoints.getContext('2d'), {
        type: 'bar',
        data: {
            labels: shortLabels,
            datasets: [
                {
                    label: 'Điểm + TB',
                    data: pointsData,
                    backgroundColor: pointColors,
                    borderColor: pointColors.map(function (c) {
                        return c.replace('0.8', '1').replace('0.6', '1').replace('0.5', '1');
                    }),
                    borderWidth: 1,
                    borderRadius: 10,
                    maxBarThickness: 36
                }
            ]
        },
        options: Object.assign({}, commonOptions, {
            plugins: Object.assign({}, commonOptions.plugins, {
                legend: { display: false }
            })
        })
    });
}

function renderStatsTable(rows) {
    const tbody = document.getElementById('statsDetailBody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-sub);">Chưa có lớp nào.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(function (r) {
        const pts = r.avgPoints;
        let ptsHtml = '—';
        if (pts !== null && pts !== undefined) {
            const cls = pts > 0 ? 'pos' : pts < 0 ? 'neg' : 'muted';
            const txt = pts > 0 ? ('+' + pts.toFixed(1)) : pts.toFixed(1);
            ptsHtml = '<span class="' + cls + '">' + txt + '</span>';
        }
        return (
            '<tr>' +
            '<td><b>' + String(r.name || '').replace(/</g, '&lt;') + '</b></td>' +
            '<td>' + r.grade + '</td>' +
            '<td>' + r.studentCount + '</td>' +
            '<td>' + (r.avgHk1 != null ? r.avgHk1.toFixed(1) : '<span class="muted">—</span>') + '</td>' +
            '<td>' + (r.avgHk2 != null ? r.avgHk2.toFixed(1) : '<span class="muted">—</span>') + '</td>' +
            '<td>' + (r.avgYear != null ? r.avgYear.toFixed(1) : '<span class="muted">—</span>') + '</td>' +
            '<td>' + ptsHtml + '</td>' +
            '</tr>'
        );
    }).join('');
}

function renderStatsSummary(rows) {
    const bar = document.getElementById('statsSummaryBar');
    if (!bar) return;
    const nClass = rows.length;
    const nStudents = rows.reduce(function (a, r) { return a + (r.studentCount || 0); }, 0);
    const years = rows.map(function (r) { return r.avgYear; }).filter(function (v) { return v != null; });
    const overallYear = meanOf(years);
    const pts = rows.map(function (r) { return r.avgPoints; }).filter(function (v) { return v != null; });
    const overallPts = pts.length
        ? round1(pts.reduce(function (a, b) { return a + b; }, 0) / pts.length)
        : null;

    bar.innerHTML =
        '<span class="stats-pill"><i class="fa-solid fa-chalkboard"></i> Lớp: <span class="num">' + nClass + '</span></span>' +
        '<span class="stats-pill"><i class="fa-solid fa-users"></i> Học sinh: <span class="num">' + nStudents + '</span></span>' +
        '<span class="stats-pill"><i class="fa-solid fa-star"></i> ĐTB cả năm (TB các lớp): <span class="num">' +
        (overallYear != null ? overallYear.toFixed(1) : '—') + '</span></span>' +
        '<span class="stats-pill"><i class="fa-solid fa-plus"></i> Điểm + TB: <span class="num">' +
        (overallPts != null ? (overallPts > 0 ? '+' : '') + overallPts.toFixed(1) : '—') + '</span></span>';
}

window.loadStatsPage = async function () {
    if (!window.location.pathname.includes('stats.html')) return;
    if (!currentUser) return;
    if (_statsLoading) return;
    _statsLoading = true;

    const btn = document.getElementById('btnRefreshStatsCharts');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
    }

    try {
        const rows = await fetchClassStatsData();
        renderStatsSummary(rows);
        renderStatsCharts(rows);
        renderStatsTable(rows);

        const el = document.getElementById('statsLastUpdated');
        if (el) {
            const now = new Date();
            el.textContent = 'Cập nhật: ' + now.toLocaleTimeString('vi-VN') + ' · ' + now.toLocaleDateString('vi-VN');
        }
    } catch (e) {
        console.error('loadStatsPage', e);
        const tbody = document.getElementById('statsDetailBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Lỗi tải thống kê: ' +
                String(e.message || e).replace(/</g, '&lt;') + '</td></tr>';
        }
    } finally {
        _statsLoading = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Làm mới';
        }
    }
};

function initStatsPage() {
    if (!window.location.pathname.includes('stats.html')) return;

    if (!_statsPageInited) {
        _statsPageInited = true;
        document.getElementById('btnRefreshStatsCharts')?.addEventListener('click', function () {
            loadStatsPage();
        });

        if (_statsRefreshTimer) clearInterval(_statsRefreshTimer);
        _statsRefreshTimer = setInterval(function () {
            if (document.visibilityState === 'visible' && currentUser) {
                loadStatsPage();
            }
        }, 45000);

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.attributeName === 'data-theme') {
                    loadStatsPage();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
    }

    loadStatsPage();
}

(function patchApplyUserSessionForStats() {
    const _prev = applyUserSession;
    applyUserSession = function (user) {
        _prev(user);
        document.querySelectorAll('.nav-stats-link').forEach(function (el) {
            el.style.display = user ? '' : 'none';
        });
        if (window.location.pathname.includes('stats.html')) {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            initStatsPage();
        }
    };
})();
// --- HIỂN THỊ THỨ + NGÀY TRÊN TRANG LỚP HỌC ---
function getVietnameseWeekday(date) {
    const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return names[date.getDay()];
}

function formatDateDMY(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return d + '/' + m + '/' + y;
}

window.updateClassTodayBadge = function () {
    const elW = document.getElementById('classTodayWeekday');
    const elD = document.getElementById('classTodayYmd');
    if (!elW && !elD) return;
    const now = new Date();
    if (elW) elW.textContent = getVietnameseWeekday(now);
    if (elD) elD.textContent = formatDateDMY(now);
};

(function initClassTodayBadge() {
    function run() {
        updateClassTodayBadge();
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
        const ms = Math.max(1000, next - now);
        setTimeout(function () {
            updateClassTodayBadge();
            setInterval(updateClassTodayBadge, 60 * 60 * 1000);
        }, ms);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
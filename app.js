const SUPABASE_URL = 'https://wxeifjtogdqxebubkviv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZWlmanRvZ2RxeGVidWJrdml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTQ2NTAsImV4cCI6MjEwMDc5MDY1MH0.l2W0EbCKrCUPS7EjY0rCz1cPCzWy344SaBk4jATTA7I';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentClassId = null;
let currentClassGrade = 1;
let currentClassName = '';
let currentStudents = [];
let currentUser = null;
let isRandomizing = false;

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
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';

        if (window.location.pathname.includes('class.html') || window.location.pathname.includes('tkb.html')) {
            window.location.href = 'login.html';
        }
    }
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
    if (!input || isNaN(parseInt(input, 10))) return;

    const amount = parseInt(input, 10);
    const student = currentStudents.find(s => String(s.id) === String(studentId));
    const newPoints = (Number(student.points) || 0) + (type === 1 ? amount : -amount);

    await _supabase.from('students').update({ points: newPoints }).eq('id', studentId);
    closePointModal();
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
                alert('Lỗi khi lưu: ' + error.message);
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

        alert('Đã lưu điểm môn "' + subject + '" thành công!');
        closeSubjectScores();
    } catch (e) {
        alert('Lỗi: ' + e.message);
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
    if (!currentUser) return alert('Vui lòng đăng nhập!');

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
        if (error) alert('Lỗi khi lưu: ' + error.message);
        else alert('Lưu Thời Khóa Biểu thành công!');
    } else {
        alert('Đã xóa trống lịch biểu!');
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

    if (timerTotalSeconds <= 0) return alert('Vui lòng nhập số thời gian hẹn giờ!');

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
        return alert('Vui lòng mở một lớp để xuất danh sách.');
    }
    if (!currentStudents || !currentStudents.length) {
        return alert('Lớp chưa có học sinh.');
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

        alert('Đã xuất file Excel (2 sheet):\n• TomTat — thông tin + đánh giá AI\n• DiemChiTiet — điểm từng môn (dạng dọc, gọn)\n\n' + filename);
    } catch (e) {
        console.error(e);
        alert('Lỗi khi xuất file: ' + (e.message || e));
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
        document.getElementById('userDropdown')?.classList.remove('show');
        const container = document.querySelector('.dropdown-tools');
        if (container && !container.contains(e.target)) {
            closeToolsMenu();
        }
    };

    const clickAction = (id, func) => { const el = document.getElementById(id); if (el) el.onclick = func; };

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
        if (error) alert(error.message); else alert('Đăng ký thành công!');
    });

    clickAction('btnLogout', async () => {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    clickAction('btnAddClass', async () => {
        const name = document.getElementById('className').value.trim();
        const gradeEl = document.getElementById('classGrade');
        const grade = parseInt(gradeEl?.value, 10) || 1;
        if (!name) return alert('Nhập tên lớp');
        if (!currentUser) return alert('Vui lòng đăng nhập');
        if (grade < 1 || grade > 9) return alert('Khối lớp phải từ 1 đến 9');

        const btn = document.getElementById('btnAddClass');
        if (btn) { btn.disabled = true; btn.innerText = 'Đang tạo...'; }

        let { error } = await _supabase.from('classes').insert([{ name, user_id: currentUser.id, grade_level: grade }]);

        if (error && (error.message || '').toLowerCase().includes('grade_level')) {
            const retry = await _supabase.from('classes').insert([{ name, user_id: currentUser.id }]);
            error = retry.error;
            if (!error) alert('Đã tạo lớp (chưa có cột grade_level — hãy chạy SQL_HOCBA.sql)');
        }

        if (btn) { btn.disabled = false; btn.innerText = 'Tạo'; }

        if (error) {
            alert('Lỗi tạo lớp: ' + error.message);
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

        if (!name || !rawNumber) return alert('Nhập đủ Tên và STT');

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
            alert(error.message);
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
        if (!currentStudents.length) return alert('Lớp trống');
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
        alert('Vui lòng nhập đầy đủ Tên và STT!');
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
            alert('Lỗi cập nhật: ' + error.message);
            return;
        }

        alert('Cập nhật thông tin học sinh thành công!');
        closeGradebook();
        if (typeof loadStudents === 'function') {
            loadStudents(); // Load lại danh sách bên ngoài trang chính
        }
    } catch (err) {
        console.error('Lỗi lưu thông tin:', err);
        alert('Có lỗi xảy ra khi lưu dữ liệu!');
    }
};

// --- HÀM ĐÓNG HỌC BẠ ---
window.closeGradebook = function () {
    document.getElementById('subjectScoreOverlay')?.remove();
    const modal = document.getElementById('gradebookOverlay');
    if (modal) modal.remove();
    window._gbCache = null;
};
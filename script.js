// ============================================================
// script.js — Sequential Circuit Design Automation System
// 修正版：
//   1. Next State / Z 改為下拉選單（防呆機制）
//   2. 電路圖佈線修正：Q1'/Q0' 回授線路不再斷線
// ============================================================

// ============================================================
// §1  全域常數與狀態
// ============================================================

/**
 * fixedInputs：State Table 左側兩欄（Present State + X）
 * 完全固定，不允許使用者修改，避免非法輸入導致運算崩潰。
 */
const fixedInputs = [
    { present: 'A', x: '0' },
    { present: 'A', x: '1' },
    { present: 'B', x: '0' },
    { present: 'B', x: '1' },
    { present: 'C', x: '0' },
    { present: 'C', x: '1' },
];

/**
 * defaultOutputs：範例電路的預設 Next State / Z 值。
 * 對應 fixedInputs 每一列。
 */
const defaultOutputs = [
    { next: 'A', z: '0' },
    { next: 'B', z: '0' },
    { next: 'C', z: '1' },
    { next: 'A', z: '0' },
    { next: 'A', z: '1' },
    { next: 'C', z: '1' },
];

/**
 * stateCode：各狀態的二進位編碼 [Q1, Q0]
 * A=00, B=01, C=10 (Gray Code 排列)
 */
const stateCode = { 'A': [0, 0], 'B': [0, 1], 'C': [1, 0] };

// ── Canvas 平移 / 縮放狀態 ──
let canvasScale = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging   = false;
let dragStartX   = 0;
let dragStartY   = 0;

// ── 最近一次計算結果（供重繪使用）──
let currentEquations  = null;
let currentExcitation = null;

// ============================================================
// §2  頁面初始化
// ============================================================

window.onload = function () {
    loadExample();       // 預填範例資料並立即計算
    initCanvasEvents();  // 啟動 Canvas 拖曳監聽
};

// ============================================================
// §3  State Table 建立與讀取
// ============================================================

/**
 * buildTableRow — 產生一列 State Table 的 HTML。
 *
 * 【修正重點】Next State 與 Z 改為 <select> 下拉選單：
 *   - Next State：只能選 A / B / C，完全杜絕非法狀態輸入
 *   - Z：只能選 0 / 1，完全杜絕非法輸出輸入
 * 這在工程軟體設計中稱為「防呆機制 (Fool-Proof / Poka-Yoke)」。
 *
 * @param {number} i          - 列索引（0–5）
 * @param {string} nextVal    - Next State 預設值（'A'/'B'/'C'）
 * @param {string} zVal       - Z 預設值（'0'/'1'/''）
 * @returns {HTMLTableRowElement}
 */
function buildTableRow(i, nextVal, zVal) {
    const tr = document.createElement('tr');

    // Next State 下拉選單：只接受有效狀態
    const nextOptions = ['A', 'B', 'C']
        .map(s => `<option value="${s}" ${s === nextVal ? 'selected' : ''}>${s}</option>`)
        .join('');

    // Z 下拉選單：只接受 0 或 1
    const zOptions = ['0', '1']
        .map(v => `<option value="${v}" ${v === zVal ? 'selected' : ''}>${v}</option>`)
        .join('');

    tr.innerHTML = `
        <td class="fixed-cell">${fixedInputs[i].present}</td>
        <td class="fixed-cell">${fixedInputs[i].x}</td>
        <td>
            <select id="next_${i}" class="cell-select">
                ${nextOptions}
            </select>
        </td>
        <td>
            <select id="z_${i}" class="cell-select cell-select-z">
                ${zOptions}
            </select>
        </td>
    `;
    return tr;
}

/**
 * loadExample — 填入預設範例並執行計算。
 */
function loadExample() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((_, i) => {
        tbody.appendChild(
            buildTableRow(i, defaultOutputs[i].next, defaultOutputs[i].z)
        );
    });
    generateSystem();
}

/**
 * clearTable — 清空輸出欄（Next State 重設為 A，Z 重設為 0）。
 */
function clearTable() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((_, i) => {
        tbody.appendChild(buildTableRow(i, 'A', '0'));
    });
    generateSystem();
}

/**
 * readTruthTable — 讀取 State Table，轉換為 Truth Table 陣列。
 *
 * Truth Table 共 8 列（3 個輸入：Q1, Q0, X）。
 * 狀態 C 對應的 Q1=1,Q0=1（index 6,7）不存在於 stateCode，視為 don't-care。
 *
 * @returns {Array<Object|null>} 長度為 8 的陣列，每項含 {q1,q0,x,nq1,nq0,z}
 */
function readTruthTable() {
    // 預設全部為 don't-care（undefined 狀態不存在）
    let tt = Array(8).fill(null).map(() => ({
        q1: 'X', q0: 'X', x: 'X',
        nq1: 'X', nq0: 'X', z: 'X'
    }));

    for (let i = 0; i < 6; i++) {
        const pres   = fixedInputs[i].present;
        const xVal   = parseInt(fixedInputs[i].x, 10);
        const nextSt = document.getElementById(`next_${i}`).value;  // 已是有效狀態
        const zVal   = parseInt(document.getElementById(`z_${i}`).value, 10); // 已是 0/1

        const q   = stateCode[pres];    // [Q1, Q0] of Present State
        const nq  = stateCode[nextSt];  // [Q1, Q0] of Next State

        // minterm index：Q1 是 bit2，Q0 是 bit1，X 是 bit0
        const index = (q[0] << 2) | (q[1] << 1) | xVal;

        tt[index] = {
            q1: q[0], q0: q[1], x: xVal,
            nq1: nq[0], nq0: nq[1],
            z: zVal
        };
    }
    return tt;
}

// ============================================================
// §4  激發函數計算 (Excitation Table)
// ============================================================

/**
 * calculateExcitation — 根據 FF 類型計算每個 minterm 的激發輸入。
 *
 * JK Flip-Flop 激發規則：
 *   Q=0, Q+=0  →  J=0, K=X
 *   Q=0, Q+=1  →  J=1, K=X
 *   Q=1, Q+=0  →  J=X, K=1
 *   Q=1, Q+=1  →  J=X, K=0
 *
 * D Flip-Flop 激發規則：
 *   D = Q+（下一個狀態即為 D 輸入）
 *
 * @param {Array}  tt     - readTruthTable() 的回傳值
 * @param {string} ffType - 'jk' | 'd'
 * @returns {Object} 各激發輸入的 8 元素陣列
 */
function calculateExcitation(tt, ffType) {
    // 初始化：每個激發輸入都有 8 個 minterm 的值
    let ex = {
        J1: [], K1: [], J0: [], K0: [],
        D1: [], D0: [],
        Z: []
    };

    for (let i = 0; i < 8; i++) {
        const row = tt[i];

        // don't-care row（原本不存在的狀態）
        if (row.nq1 === 'X') {
            ['J1','K1','J0','K0','D1','D0','Z'].forEach(k => ex[k].push('X'));
            continue;
        }

        ex.Z.push(row.z);

        if (ffType === 'd') {
            // D FF：D 直接等於次態
            ex.D1.push(row.nq1);
            ex.D0.push(row.nq0);
            // JK 欄位填 don't-care（D 模式不使用）
            ex.J1.push('X'); ex.K1.push('X');
            ex.J0.push('X'); ex.K0.push('X');
        } else {
            // JK FF 激發邏輯
            ex.J1.push(row.q1 === 0 ? row.nq1      : 'X');
            ex.K1.push(row.q1 === 1 ? (1 - row.nq1): 'X');
            ex.J0.push(row.q0 === 0 ? row.nq0      : 'X');
            ex.K0.push(row.q0 === 1 ? (1 - row.nq0): 'X');
            ex.D1.push('X'); ex.D0.push('X');
        }
    }
    return ex;
}

// ============================================================
// §5  布林函數化簡 (Quine-McCluskey 近似 / Greedy K-Map)
// ============================================================

/**
 * minimizeLogic — 對每個激發函數執行 greedy prime implicant 化簡。
 *
 * 所有可能的 prime implicant（3 變數：Q1, Q0, X）預先列舉。
 * 演算法：每次選擇「涵蓋最多未覆蓋 minterm 且不涵蓋任何 0」的 implicant。
 *
 * @param {Object} ex     - calculateExcitation() 回傳值
 * @param {string} ffType - 'jk' | 'd'
 * @returns {Object} 各方程式的化簡字串
 */
function minimizeLogic(ex, ffType) {
    // 所有可能的 prime implicant（從大到小排列，greedy 偏好大的）
    const implicants = [
        // 1 項（涵蓋 8 個 minterm）
        { term: "1",        mask: 0b000, val: 0b000, size: 8 },
        // 2 項（涵蓋 4 個 minterm）
        { term: "Q1",       mask: 0b100, val: 0b100, size: 4 },
        { term: "Q1'",      mask: 0b100, val: 0b000, size: 4 },
        { term: "Q0",       mask: 0b010, val: 0b010, size: 4 },
        { term: "Q0'",      mask: 0b010, val: 0b000, size: 4 },
        { term: "X",        mask: 0b001, val: 0b001, size: 4 },
        { term: "X'",       mask: 0b001, val: 0b000, size: 4 },
        // 3 項（涵蓋 2 個 minterm）
        { term: "Q1·Q0",    mask: 0b110, val: 0b110, size: 2 },
        { term: "Q1·Q0'",   mask: 0b110, val: 0b100, size: 2 },
        { term: "Q1'·Q0",   mask: 0b110, val: 0b010, size: 2 },
        { term: "Q1'·Q0'",  mask: 0b110, val: 0b000, size: 2 },
        { term: "Q1·X",     mask: 0b101, val: 0b101, size: 2 },
        { term: "Q1·X'",    mask: 0b101, val: 0b100, size: 2 },
        { term: "Q1'·X",    mask: 0b101, val: 0b001, size: 2 },
        { term: "Q1'·X'",   mask: 0b101, val: 0b000, size: 2 },
        { term: "Q0·X",     mask: 0b011, val: 0b011, size: 2 },
        { term: "Q0·X'",    mask: 0b011, val: 0b010, size: 2 },
        { term: "Q0'·X",    mask: 0b011, val: 0b001, size: 2 },
        { term: "Q0'·X'",   mask: 0b011, val: 0b000, size: 2 },
        // 4 項（涵蓋 1 個 minterm）—— 僅當無法更大群組覆蓋時使用
        { term: "Q1·Q0·X",      mask: 0b111, val: 0b111, size: 1 },
        { term: "Q1·Q0·X'",     mask: 0b111, val: 0b110, size: 1 },
        { term: "Q1·Q0'·X",     mask: 0b111, val: 0b101, size: 1 },
        { term: "Q1·Q0'·X'",    mask: 0b111, val: 0b100, size: 1 },
        { term: "Q1'·Q0·X",     mask: 0b111, val: 0b011, size: 1 },
        { term: "Q1'·Q0·X'",    mask: 0b111, val: 0b010, size: 1 },
        { term: "Q1'·Q0'·X",    mask: 0b111, val: 0b001, size: 1 },
        { term: "Q1'·Q0'·X'",   mask: 0b111, val: 0b000, size: 1 },
    ];

    /**
     * solve — 對單一激發函數執行化簡。
     * @param {Array} truthArr - 8 元素陣列（值為 0 / 1 / 'X'）
     * @returns {string} 化簡後的布林表達式
     */
    function solve(truthArr) {
        const ones = [], dcs = [];
        for (let i = 0; i < 8; i++) {
            if (truthArr[i] == 1)    ones.push(i);
            if (truthArr[i] === 'X') dcs.push(i);
        }
        if (ones.length === 0)            return "0";
        if (ones.length + dcs.length === 8) return "1";

        const selected = [];
        const covered  = new Set();

        // Greedy：反覆選擇最佳 prime implicant
        while (covered.size < ones.length) {
            let bestImp   = null;
            let bestCover = [];

            for (const imp of implicants) {
                const currentCover = [];
                let   valid = true;

                for (let i = 0; i < 8; i++) {
                    if ((i & imp.mask) === imp.val) {
                        if (truthArr[i] == 0) { valid = false; break; }     // 涵蓋 0 → 無效
                        if (truthArr[i] == 1 && !covered.has(i)) {
                            currentCover.push(i);
                        }
                    }
                }
                // 選擇：新覆蓋數更多，或相同時選更大的 implicant
                if (valid && (
                    currentCover.length > bestCover.length ||
                    (currentCover.length === bestCover.length &&
                     bestImp && imp.size > bestImp.size)
                )) {
                    bestImp   = imp;
                    bestCover = currentCover;
                }
            }
            if (!bestImp) break;  // 無法繼續（理論上不會發生）
            selected.push(bestImp.term);
            bestCover.forEach(idx => covered.add(idx));
        }

        return selected.length > 0 ? selected.join(" + ") : "0";
    }

    // 根據 FF 類型計算對應的方程式
    const eq = {};
    if (ffType === 'jk') {
        eq.J1 = solve(ex.J1);
        eq.K1 = solve(ex.K1);
        eq.J0 = solve(ex.J0);
        eq.K0 = solve(ex.K0);
    } else {
        eq.D1 = solve(ex.D1);
        eq.D0 = solve(ex.D0);
    }
    eq.Z = solve(ex.Z);
    return eq;
}

// ============================================================
// §6  主計算流程
// ============================================================

/**
 * generateSystem — 讀取使用者輸入，完整執行計算流程並更新畫面。
 * 呼叫順序：
 *   1. 讀取 State Table
 *   2. 計算激發函數
 *   3. 化簡布林函數
 *   4. 渲染 Output 1（方程式 + K-Map）
 *   5. 繪製 Output 2（電路圖）
 */
function generateSystem() {
    const ffType    = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;

    const truthTable      = readTruthTable();
    currentExcitation     = calculateExcitation(truthTable, ffType);
    currentEquations      = minimizeLogic(currentExcitation, ffType);

    renderOutput1(currentEquations, ffType);
    drawDynamicCircuit(currentEquations, ffType, modelType);
}

// ============================================================
// §7  Output 1 渲染：方程式表格 + K-Map
// ============================================================

/**
 * renderOutput1 — 更新 Output 1 面板的方程式表格與 K-Map 選單。
 */
function renderOutput1(eq, ffType) {
    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = '';

    // 依 FF 類型決定要顯示哪些方程式
    const keys = ffType === 'jk'
        ? ['J1', 'K1', 'J0', 'K0']
        : ['D1', 'D0'];

    keys.forEach(k => {
        const tr = document.createElement('tr');
        // FF 欄：顯示是哪個 Flip-Flop（以數字區分）
        const ffLabel = `FF for Q${k.charAt(1)}`;
        tr.innerHTML = `
            <td>${ffLabel}</td>
            <td style="font-weight:bold;">${k}</td>
            <td style="color:#2563eb; font-weight:bold; font-family:monospace;">
                ${k} = ${eq[k]}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // K-Map 下拉選單
    let selectHTML = `<select class="kmap-select" onchange="updateKMap(this.value)">`;
    keys.forEach(k => {
        selectHTML += `<option value="${k}">K-Map for ${k}</option>`;
    });
    selectHTML += `<option value="Z">K-Map for Z</option></select>`;

    document.getElementById('kmap-container').innerHTML = `
        <div style="text-align:center; margin-bottom:10px;">
            <label style="font-weight:600; color:#475569;">
                Select Input / Output:
            </label>
            ${selectHTML}
        </div>
        <div id="kmap-visual-box"></div>
    `;

    // 預設顯示第一個 K-Map
    updateKMap(keys[0]);
}

/**
 * updateKMap — 依選取的變數名稱，渲染對應的 K-Map 表格。
 *
 * K-Map 布局（3 變數：Q1, Q0, X）：
 *   欄 header：Q0X = 00 | 01 | 11 | 10（Gray Code）
 *   列 header：Q1  = 0 | 1
 *   minterm 對應：index = (Q1<<2)|(Q0<<1)|X
 *
 * @param {string} selectedKey - 'J1'/'K1'/'J0'/'K0'/'D1'/'D0'/'Z'
 */
function updateKMap(selectedKey) {
    if (!currentExcitation || !currentEquations) return;

    const arr   = currentExcitation[selectedKey]; // 8 元素激發值陣列
    const eqStr = currentEquations[selectedKey];  // 化簡方程式字串

    // Gray Code 欄序：00→0, 01→1, 11→3, 10→2
    // 對應 minterm index（Q1 固定）：
    //   Q1=0: [0,1,3,2]  →  arr[0], arr[1], arr[3], arr[2]
    //   Q1=1: [4,5,7,6]  →  arr[4], arr[5], arr[7], arr[6]
    function cellStyle(val) {
        if (val == 1)    return 'background:#dcfce7; color:#15803d; font-weight:bold;'; // 綠：minterm 1
        if (val === 'X') return 'background:#fef9c3; color:#92400e;';                   // 黃：don't-care
        return 'color:#94a3b8;';                                                         // 灰：minterm 0
    }

    const rows = [
        { label: '0', idxs: [0, 1, 3, 2] },
        { label: '1', idxs: [4, 5, 7, 6] },
    ];

    let tableHTML = `
        <table style="width:90%; margin:auto; border-collapse:collapse;
                      text-align:center; font-size:0.9rem;">
            <tr>
                <th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">
                    Q1 \\ Q0X
                </th>
                <th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">00</th>
                <th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">01</th>
                <th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">11</th>
                <th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">10</th>
            </tr>
    `;

    rows.forEach(r => {
        tableHTML += `<tr>
            <th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">${r.label}</th>`;
        r.idxs.forEach(i => {
            const val = arr[i];
            const displayVal = (val === 'X') ? 'X' : String(val);
            tableHTML += `<td style="${cellStyle(val)} padding:6px 8px; border:1px solid #cbd5e1;">
                ${displayVal}
            </td>`;
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</table>
        <p style="margin-top:10px; text-align:center; font-size:1.05rem;
                  color:#16a34a; font-weight:bold; font-family:monospace;">
            (Simplified) ${selectedKey} = ${eqStr}
        </p>`;

    document.getElementById('kmap-visual-box').innerHTML = tableHTML;
}

// ============================================================
// §8  Canvas 平移 / 縮放互動
// ============================================================

/** initCanvasEvents — 綁定 Canvas 的滑鼠拖曳事件。 */
function initCanvasEvents() {
    const canvas = document.getElementById('circuitCanvas');

    canvas.addEventListener('mousedown', e => {
        isDragging = true;
        dragStartX = e.clientX - offsetX;
        dragStartY = e.clientY - offsetY;
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        offsetX = e.clientX - dragStartX;
        offsetY = e.clientY - dragStartY;
        redrawCircuit();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
}

/** zoomCanvas — 調整縮放比例並重繪。 */
function zoomCanvas(delta) {
    canvasScale = Math.min(2.5, Math.max(0.4, canvasScale + delta));
    redrawCircuit();
}

/** resetZoom — 重設縮放與平移，回到預設視角。 */
function resetZoom() {
    canvasScale = 1.0;
    offsetX = 0;
    offsetY = 0;
    redrawCircuit();
}

/** redrawCircuit — 使用最新計算結果重繪電路圖。 */
function redrawCircuit() {
    if (!currentEquations) return;
    const ffType    = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    drawDynamicCircuit(currentEquations, ffType, modelType);
}

// ============================================================
// §9  電路圖繪製引擎 (Output 2)
// ============================================================

/**
 * 匯流排 Y 座標定義（相對於 Canvas 左上角）。
 *
 * 【修正說明】
 * 原版 busRails 的 Y 值：X=30, X'=50, Q1=70, Q1'=90, Q0=110, Q0'=130
 * 而 FF 的 Q' 腳位在 (ffY + 90)，Q1 FF 的 Y=200，所以 Q' 腳位在 290。
 * 原版試圖從 y=290 拉線向上至 busRails["Q1'"]=90，路徑正確，
 * 但 routeToGateInput 的 dropX 計算位置與 bus 實際範圍有衝突，
 * 導致垂直線畫到 busRails Y 而 bus 本身長度不夠長，造成視覺上「斷線」。
 *
 * 修正方式：
 *   1. 增加 bus 水平線的繪製起點（從更左側開始）。
 *   2. Q'/Q 的回授線路改用獨立路由函數，精確計算每段線段座標。
 *   3. 所有 bus tap（接觸點）都使用 drawDot 標記，確保連接清晰可見。
 */
const BUS = {
    X:   30,   // X 訊號水平匯流排 Y 座標
    Xn:  55,   // X' 訊號水平匯流排 Y 座標（含 NOT gate 高度）
    Q1:  80,   // Q1 回授匯流排 Y 座標
    Q1n: 105,  // Q1' 回授匯流排 Y 座標
    Q0:  130,  // Q0 回授匯流排 Y 座標
    Q0n: 155,  // Q0' 回授匯流排 Y 座標
};

// Bus 名稱與 BUS 物件 key 的對應（供 connectToBus 使用）
const BUS_KEY = {
    "X":   "X",
    "X'":  "Xn",
    "Q1":  "Q1",
    "Q1'": "Q1n",
    "Q0":  "Q0",
    "Q0'": "Q0n",
};

/**
 * drawDynamicCircuit — 主繪圖函數。
 *
 * 繪製順序：
 *   1. 套用座標變換（縮放 + 平移）
 *   2. 繪製 X / X' 輸入匯流排
 *   3. 繪製 Flip-Flop 元件
 *   4. 繪製 Q / Q' 回授匯流排（修正版）
 *   5. 繪製 CLK 匯流排
 *   6. 解析方程式並路由邏輯閘
 *   7. 繪製輸出 Z
 *
 * @param {Object} eq       - 化簡方程式物件
 * @param {string} ffType   - 'jk' | 'd'
 * @param {string} modelType - 'mealy' | 'moore'
 */
function drawDynamicCircuit(eq, ffType, modelType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx    = canvas.getContext('2d');

    // ── 清除並套用變換 ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
    ctx.scale(canvasScale, canvasScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // 基本畫筆設定
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth   = 1.5;
    ctx.fillStyle   = '#1e293b';
    ctx.font        = 'bold 11px Courier New';

    const W       = canvas.width;   // 800
    const BUS_L   = 18;             // 匯流排左側 X 起點（文字後留白）
    const BUS_R   = W - 30;         // 匯流排右側終點

    // ── Flip-Flop 元件座標 ──
    const FF1 = { x: 270, y: 220 };  // Q1 Flip-Flop 左上角
    const FF2 = { x: 490, y: 220 };  // Q0 Flip-Flop 左上角
    const FF_W = 65, FF_H = 110;      // FF 寬高

    // ============================================================
    // Step 1：X / X' 輸入匯流排
    // ============================================================

    // X 匯流排（頂部）
    setStyle(ctx, '#1e293b', 1.5);
    ctx.fillText("X", 3, BUS.X + 4);
    drawHLine(ctx, BUS_L, BUS_R, BUS.X);

    // NOT gate 繪製：X → X'
    // NOT 輸入 tap 在 x=55 處向下接到 NOT gate
    const notTapX = 55;
    drawDot(ctx, notTapX, BUS.X);
    drawVLine(ctx, notTapX, BUS.X, BUS.X + 20);   // 向下進入 NOT gate
    drawNOTGate(ctx, notTapX - 8, BUS.X + 20);    // NOT gate 本體（輸出在右側）
    // NOT gate 輸出連接到 X' 匯流排
    drawHLine(ctx, notTapX + 22, BUS_R, BUS.Xn);  // X' 匯流排（NOT 輸出右延伸）
    drawHLine(ctx, BUS_L, notTapX - 8, BUS.Xn);   // X' 匯流排左段（讓標籤接上）
    ctx.fillText("X'", 3, BUS.Xn + 4);

    // ============================================================
    // Step 2：繪製 Flip-Flop 元件主體
    // ============================================================

    if (ffType === 'jk') {
        drawJKFlipFlop(ctx, FF1.x, FF1.y, "Q1");
        drawJKFlipFlop(ctx, FF2.x, FF2.y, "Q0");
    } else {
        drawDFlipFlop(ctx, FF1.x, FF1.y, "Q1");
        drawDFlipFlop(ctx, FF2.x, FF2.y, "Q0");
    }

    // ============================================================
    // Step 3：Q / Q' 回授匯流排
    //
    // 【修正核心】
    // 每個 FF 有兩個輸出腳位：
    //   Q  腳：FF 右側 y + 35（正輸出）
    //   Q' 腳：FF 右側 y + 75（補輸出）
    //
    // 回授路由策略：
    //   - 向右延伸一小段（避免與 FF 邊框重疊）
    //   - 再向上路由至對應的匯流排 Y 座標
    //   - 水平向左延伸到匯流排起點
    //   - 在匯流排上標記 drawDot
    //
    // Q1 FF 的 Q  腳：(FF1.x + FF_W, FF1.y + 35) → 向右到 x=360 → 向上到 BUS.Q1  → 向左
    // Q1 FF 的 Q' 腳：(FF1.x + FF_W, FF1.y + 75) → 向右到 x=370 → 向上到 BUS.Q1n → 向左
    // Q0 FF 的 Q  腳：(FF2.x + FF_W, FF2.y + 35) → 向右到 x=580 → 向上到 BUS.Q0  → 向左
    // Q0 FF 的 Q' 腳：(FF2.x + FF_W, FF2.y + 75) → 向右到 x=590 → 向上到 BUS.Q0n → 向左
    //
    // 使用不同的 x 偏移（360/370、580/590）是為了讓 Q 與 Q' 的垂直線錯開，
    // 避免視覺重疊造成混淆。
    // ============================================================

    // Q1 正輸出回授
    const q1QOutX  = FF1.x + FF_W;
    const q1QOutY  = FF1.y + 35;
    const q1QTapX  = q1QOutX + 15;   // x=350，向右延伸後再向上
    drawHLine(ctx, q1QOutX, q1QTapX, q1QOutY);
    drawVLine(ctx, q1QTapX, BUS.Q1, q1QOutY);   // 從 bus 向下到腳位 Y
    drawHLine(ctx, BUS_L, q1QTapX, BUS.Q1);     // 匯流排左段
    drawDot(ctx, q1QTapX, BUS.Q1);
    ctx.fillText("Q1", 3, BUS.Q1 + 4);

    // Q1 補輸出（Q1'）回授
    const q1QnOutY = FF1.y + 75;
    const q1QnTapX = q1QTapX + 12;  // x=362，與 Q1 線錯開
    drawHLine(ctx, q1QOutX, q1QnTapX, q1QnOutY);
    drawVLine(ctx, q1QnTapX, BUS.Q1n, q1QnOutY);
    drawHLine(ctx, BUS_L, q1QnTapX, BUS.Q1n);
    drawDot(ctx, q1QnTapX, BUS.Q1n);
    ctx.fillText("Q1'", 3, BUS.Q1n + 4);

    // Q0 正輸出回授
    const q0QOutX  = FF2.x + FF_W;
    const q0QOutY  = FF2.y + 35;
    const q0QTapX  = q0QOutX + 15;  // x=570
    drawHLine(ctx, q0QOutX, q0QTapX, q0QOutY);
    drawVLine(ctx, q0QTapX, BUS.Q0, q0QOutY);
    drawHLine(ctx, BUS_L, q0QTapX, BUS.Q0);
    drawDot(ctx, q0QTapX, BUS.Q0);
    ctx.fillText("Q0", 3, BUS.Q0 + 4);

    // Q0 補輸出（Q0'）回授
    const q0QnOutY = FF2.y + 75;
    const q0QnTapX = q0QTapX + 12;  // x=582
    drawHLine(ctx, q0QOutX, q0QnTapX, q0QnOutY);
    drawVLine(ctx, q0QnTapX, BUS.Q0n, q0QnOutY);
    drawHLine(ctx, BUS_L, q0QnTapX, BUS.Q0n);
    drawDot(ctx, q0QnTapX, BUS.Q0n);
    ctx.fillText("Q0'", 3, BUS.Q0n + 4);

    // ============================================================
    // Step 4：CLK 匯流排
    // ============================================================

    const clkY = FF1.y + FF_H + 50;  // CLK 線在 FF 底部下方
    ctx.fillText("CLK", 3, clkY + 4);
    drawHLine(ctx, BUS_L, BUS_R, clkY);

    // CLK 連接到各 FF CLK 腳（FF 底部中間）
    const ff1ClkX = FF1.x + 30;
    const ff2ClkX = FF2.x + 30;
    drawVLine(ctx, ff1ClkX, FF1.y + FF_H, clkY);
    drawDot(ctx, ff1ClkX, clkY);
    drawVLine(ctx, ff2ClkX, FF2.y + FF_H, clkY);
    drawDot(ctx, ff2ClkX, clkY);

    // ============================================================
    // Step 5：解析方程式並路由邏輯閘到 FF 輸入腳位
    // ============================================================

    if (ffType === 'jk') {
        // J1 腳：FF1 左側 y+35；K1 腳：FF1 左側 y+75
        parseAndRouteGate(ctx, eq.J1, FF1.x, FF1.y + 35, FF1.x - 60);
        parseAndRouteGate(ctx, eq.K1, FF1.x, FF1.y + 75, FF1.x - 60);
        // J0 腳：FF2 左側 y+35；K0 腳：FF2 左側 y+75
        parseAndRouteGate(ctx, eq.J0, FF2.x, FF2.y + 35, FF2.x - 60);
        parseAndRouteGate(ctx, eq.K0, FF2.x, FF2.y + 75, FF2.x - 60);
    } else {
        // D1 腳：FF1 左側中間（y+55）
        parseAndRouteGate(ctx, eq.D1, FF1.x, FF1.y + 55, FF1.x - 60);
        // D0 腳：FF2 左側中間（y+55）
        parseAndRouteGate(ctx, eq.D0, FF2.x, FF2.y + 55, FF2.x - 60);
    }

    // ============================================================
    // Step 6：輸出 Z
    // ============================================================

    const zGateX = BUS_R - 80;   // Z 輸出閘門的輸出端 X 座標
    const zPinY  = FF2.y + 55;   // Z 輸出 Y（與 FF2 垂直中心對齊）

    parseAndRouteGate(ctx, eq.Z, zGateX, zPinY, zGateX - 60);

    // Z 輸出線與標籤
    drawHLine(ctx, zGateX, zGateX + 30, zPinY);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 13px Courier New';
    ctx.fillText("Z", zGateX + 33, zPinY + 4);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 11px Courier New';
}

// ============================================================
// §10  閘門路由引擎
// ============================================================

/**
 * parseAndRouteGate — 解析方程式字串，選擇並繪製對應的邏輯閘結構，
 *                     並路由所有輸入訊號從匯流排連接到邏輯閘輸入腳位。
 *
 * 支援的結構：
 *   - 單一訊號 → 直連（直接從 bus 拉一條線）
 *   - 2 訊號 AND → drawANDGate
 *   - 2 訊號 OR  → drawORGate
 *   - 3+ 訊號 → f() 方塊（複雜邏輯）
 *   - "0" → GND
 *   - "1" → VCC
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} eqStr    - 布林表達式字串，例如 "Q1·X" 或 "X' + Q0"
 * @param {number} pinX     - FF 輸入腳位的 X 座標（線的終點）
 * @param {number} pinY     - FF 輸入腳位的 Y 座標
 * @param {number} gateOutX - 邏輯閘輸出端的 X 座標
 */
function parseAndRouteGate(ctx, eqStr, pinX, pinY, gateOutX) {
    if (!eqStr) return;

    // 處理常數 0 / 1
    if (eqStr === "0") {
        ctx.fillText("GND", gateOutX - 35, pinY + 4);
        drawHLine(ctx, gateOutX - 5, pinX, pinY);
        return;
    }
    if (eqStr === "1") {
        ctx.fillText("VCC", gateOutX - 35, pinY + 4);
        drawHLine(ctx, gateOutX - 5, pinX, pinY);
        return;
    }

    // 依優先順序解析訊號（Q1' 必須在 Q1 之前，否則會誤判）
    const SIG_ORDER = ["Q1'", "Q0'", "X'", "Q1", "Q0", "X"];
    const foundSigs = [];
    let tempEq = eqStr;
    SIG_ORDER.forEach(s => {
        if (tempEq.includes(s)) {
            foundSigs.push(s);
            tempEq = tempEq.split(s).join(""); // 全部替換，避免 indexOf 重複
        }
    });

    if (foundSigs.length === 0) {
        // 無法識別訊號 → 簡單文字標記
        ctx.fillText(eqStr, gateOutX - 30, pinY + 4);
        drawHLine(ctx, gateOutX, pinX, pinY);
        return;
    }

    const isOR  = eqStr.includes("+");
    // 判斷是否為 AND：有 "·" 或有多個訊號且不是純 OR 式
    const isAND = eqStr.includes("·") || (foundSigs.length > 1 && !isOR);

    const GATE_W = 32; // 閘門寬度
    const gateBodyX = gateOutX - GATE_W; // 閘門左側 X

    if (foundSigs.length === 1) {
        // ── 直連：從 bus 拉一條折線到腳位 ──
        connectBusToPin(ctx, foundSigs[0], gateOutX, pinY);
        drawHLine(ctx, gateOutX, pinX, pinY);

    } else if (foundSigs.length === 2 && !isOR) {
        // ── 2 輸入 AND 閘 ──
        drawANDGate(ctx, gateBodyX, pinY - 15);
        routeToGatePin(ctx, foundSigs[0], gateBodyX, pinY - 8);
        routeToGatePin(ctx, foundSigs[1], gateBodyX, pinY + 5);
        drawHLine(ctx, gateOutX, pinX, pinY);

    } else if (foundSigs.length === 2 && isOR) {
        // ── 2 輸入 OR 閘 ──
        drawORGate(ctx, gateBodyX, pinY - 15);
        routeToGatePin(ctx, foundSigs[0], gateBodyX, pinY - 8);
        routeToGatePin(ctx, foundSigs[1], gateBodyX, pinY + 5);
        drawHLine(ctx, gateOutX, pinX, pinY);

    } else {
        // ── 複雜邏輯：f() 方塊 ──
        // 繪製一個矩形代表複雜組合邏輯，並列出輸入訊號
        ctx.strokeRect(gateBodyX - 5, pinY - 20, GATE_W + 10, 40);
        ctx.fillText("f()", gateBodyX, pinY + 4);

        const step = 36 / Math.max(foundSigs.length - 1, 1);
        foundSigs.forEach((sig, idx) => {
            const iy = (pinY - 16) + idx * step;
            // 每條輸入線從不同 x 位置向上接 bus（避免重疊）
            const dropX = gateBodyX - 15 - idx * 6;
            connectBusToPin(ctx, sig, dropX, iy);
            drawHLine(ctx, dropX, gateBodyX - 5, iy);
        });
        drawHLine(ctx, gateOutX, pinX, pinY);
    }
}

/**
 * connectBusToPin — 從指定訊號的匯流排 Y 座標，
 *                   向下畫垂直線到目標腳位 Y，再水平線接到閘門 X。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} sigName  - 訊號名稱，如 "Q1'", "X"
 * @param {number} tapX     - 在 bus 上的垂直線 X 座標（tap 點）
 * @param {number} targetY  - 目標腳位 Y 座標
 */
function connectBusToPin(ctx, sigName, tapX, targetY) {
    const busKey = BUS_KEY[sigName];
    if (!busKey) return;
    const busY = BUS[busKey];

    // 垂直線：從 bus Y 向下到腳位 Y
    drawVLine(ctx, tapX, busY, targetY);
    drawDot(ctx, tapX, busY);   // 連接點標記
}

/**
 * routeToGatePin — 從訊號匯流排路由到邏輯閘輸入腳位。
 *                  使用 staggered tap X（基於閘門 X 計算），避免多線重疊。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} sigName  - 訊號名稱
 * @param {number} gateX    - 閘門左側 X
 * @param {number} inputY   - 閘門輸入腳位 Y
 */
function routeToGatePin(ctx, sigName, gateX, inputY) {
    const busKey = BUS_KEY[sigName];
    if (!busKey) return;
    const busY = BUS[busKey];

    // tap X 從閘門左側往左偏移（依訊號名稱哈希做小偏移，避免同一 X 重疊）
    const offset = (Object.keys(BUS_KEY).indexOf(sigName) % 4) * 5;
    const tapX   = gateX - 20 - offset;

    drawVLine(ctx, tapX, busY, inputY);    // 垂直：bus → 腳位 Y
    drawDot(ctx, tapX, busY);
    drawHLine(ctx, tapX, gateX, inputY);  // 水平：tap X → 閘門 X
}

// ============================================================
// §11  基礎繪圖元件
// ============================================================

/** setStyle — 快速設定畫筆顏色與線寬。 */
function setStyle(ctx, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.fillStyle   = color;
}

/** drawHLine — 繪製水平線（從 x1 到 x2，固定 y）。 */
function drawHLine(ctx, x1, x2, y) {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
}

/** drawVLine — 繪製垂直線（固定 x，從 y1 到 y2）。 */
function drawVLine(ctx, x, y1, y2) {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
}

/** drawDot — 繪製實心圓點（表示電路連接節點）。 */
function drawDot(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * drawNOTGate — 繪製 NOT（反相器）閘門。
 *
 * 外形：三角形 + 小圓圈（表示反相）
 * 輸入在左，輸出（含圓圈）在右。
 *
 * @param {number} x, y - 閘門左上角座標
 */
function drawNOTGate(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y + 8);   // 指向右側頂點
    ctx.lineTo(x, y + 16);
    ctx.closePath();
    ctx.stroke();
    // 反相圓圈
    ctx.beginPath();
    ctx.arc(x + 19, y + 8, 3, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * drawJKFlipFlop — 繪製 JK Flip-Flop 方塊。
 *
 * 腳位示意：
 *   左側：J（上）、K（下）
 *   右側：Q（上，+35）、Q'（下，+75）
 *   底部：CLK（三角形）
 *
 * @param {number} x, y - 方塊左上角座標
 * @param {string} label - 顯示在方塊上方的標籤（"Q1"/"Q0"）
 */
function drawJKFlipFlop(ctx, x, y, label) {
    const W = 65, H = 110;
    ctx.strokeRect(x, y, W, H);

    // 腳位標籤
    ctx.fillText("J",  x + 5,      y + 39);   // J 輸入（左上）
    ctx.fillText("K",  x + 5,      y + 79);   // K 輸入（左下）
    ctx.fillText("Q",  x + W - 20, y + 39);   // Q 輸出（右上）
    ctx.fillText("Q'", x + W - 22, y + 79);   // Q' 輸出（右下）
    ctx.fillText(label, x + 20,    y - 8);    // FF 名稱

    // CLK 三角形（底部居中）
    ctx.beginPath();
    ctx.moveTo(x + 25, y + H);
    ctx.lineTo(x + 32, y + H - 10);
    ctx.lineTo(x + 39, y + H);
    ctx.stroke();

    // 腳位引線：左側 J、K；右側 Q、Q'
    drawHLine(ctx, x - 10, x, y + 35);  // J 引線
    drawHLine(ctx, x - 10, x, y + 75);  // K 引線
}

/**
 * drawDFlipFlop — 繪製 D Flip-Flop 方塊。
 *
 * 腳位示意：
 *   左側：D（中間）
 *   右側：Q（上，+35）、Q'（下，+75）
 *   底部：CLK（三角形）
 */
function drawDFlipFlop(ctx, x, y, label) {
    const W = 65, H = 110;
    ctx.strokeRect(x, y, W, H);

    ctx.fillText("D",  x + 5,      y + 59);   // D 輸入（左中）
    ctx.fillText("Q",  x + W - 20, y + 39);   // Q 輸出（右上）
    ctx.fillText("Q'", x + W - 22, y + 79);   // Q' 輸出（右下）
    ctx.fillText(label, x + 20,    y - 8);    // FF 名稱

    // CLK 三角形
    ctx.beginPath();
    ctx.moveTo(x + 25, y + H);
    ctx.lineTo(x + 32, y + H - 10);
    ctx.lineTo(x + 39, y + H);
    ctx.stroke();

    // D 引線
    drawHLine(ctx, x - 10, x, y + 55);
}

/**
 * drawANDGate — 繪製 2 輸入 AND 閘門。
 *
 * 外形：左側垂直邊 + 右側半圓
 * 輸入在左（上下各一），輸出在右。
 *
 * @param {number} x, y - 閘門左上角座標
 */
function drawANDGate(ctx, x, y) {
    const W = 30, H = 28;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + W / 2, y);
    ctx.arc(x + W / 2, y + H / 2, H / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x, y + H);
    ctx.closePath();
    ctx.stroke();
}

/**
 * drawORGate — 繪製 2 輸入 OR 閘門。
 *
 * 外形：略彎曲的側邊 + 尖頭輸出
 * 輸入在左（上下各一），輸出在右。
 *
 * @param {number} x, y - 閘門左上角座標
 */
function drawORGate(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 12, y,       x + 30, y + 14);   // 上緣曲線
    ctx.quadraticCurveTo(x + 12, y + 28,  x,      y + 28);   // 下緣曲線
    ctx.quadraticCurveTo(x + 8,  y + 14,  x,      y);        // 左側曲線（輸入端微弓）
    ctx.stroke();
}

// ============================================================
// §12  匯出功能
// ============================================================

/**
 * downloadPNG — 將 Canvas 電路圖匯出為 PNG 並下載。
 */
function downloadPNG() {
    const link      = document.createElement('a');
    link.download   = 'Sequential_Circuit.png';
    link.href       = document.getElementById('circuitCanvas').toDataURL('image/png');
    link.click();
}

/**
 * exportPDF — 將整個頁面匯出為 A4 橫向 PDF 報告。
 * 使用 html2pdf.js 函式庫。
 */
function exportPDF() {
    html2pdf()
        .set({
            margin:     8,
            filename:   '期末專題報告_Sequential_Circuit.pdf',
            image:      { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF:      { unit: 'mm', format: 'a4', orientation: 'landscape' }
        })
        .from(document.body)
        .save();
}
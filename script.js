// ============================================================
// script.js — Sequential Circuit Design Automation System
// 修正版：
//   1. Moore Model 防呆機制：Z 值自動同步與鎖定
//   2. 匯流排 (Bus) 延伸至畫布右側，徹底解決斷線問題
// ============================================================

const fixedInputs = [
    { present: 'A', x: '0' }, { present: 'A', x: '1' },
    { present: 'B', x: '0' }, { present: 'B', x: '1' },
    { present: 'C', x: '0' }, { present: 'C', x: '1' },
];

const defaultOutputs = [
    { next: 'A', z: '0' }, { next: 'B', z: '0' },
    { next: 'C', z: '1' }, { next: 'A', z: '0' },
    { next: 'A', z: '1' }, { next: 'C', z: '1' },
];

const stateCode = { 'A': [0, 0], 'B': [0, 1], 'C': [1, 0] };

let canvasScale = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging   = false;
let dragStartX   = 0;
let dragStartY   = 0;

let currentEquations  = null;
let currentExcitation = null;

window.onload = function () {
    loadExample();       
    initCanvasEvents();  
};

// ============================================================
// § UI 防呆邏輯 (Moore / Mealy Z 同步)
// ============================================================

function toggleModelType() {
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    
    // 如果是 Moore，強制讓 X=1 (奇數列) 的 Z 值等於 X=0 (偶數列) 的 Z 值，並鎖定輸入
    for (let i = 0; i < 6; i += 2) {
        const z0 = document.getElementById(`z_${i}`);
        const z1 = document.getElementById(`z_${i+1}`);
        if (z0 && z1) {
            if (modelType === 'moore') {
                z1.value = z0.value;
                z1.disabled = true;
                z1.style.backgroundColor = "#e2e8f0";
                z1.style.color = "#94a3b8";
                z1.style.cursor = "not-allowed";
            } else {
                z1.disabled = false;
                z1.style.backgroundColor = "transparent";
                z1.style.color = "#0f172a";
                z1.style.cursor = "pointer";
            }
        }
    }
    generateSystem();
}

// 當使用者更改 X=0 列的 Z 值時，即刻同步給 X=1 列
function syncMooreZ(index) {
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    if (modelType === 'moore' && index % 2 === 0) {
        const z0 = document.getElementById(`z_${index}`);
        const z1 = document.getElementById(`z_${index+1}`);
        if (z0 && z1) z1.value = z0.value;
    }
    generateSystem();
}

function buildTableRow(i, nextVal, zVal) {
    const tr = document.createElement('tr');
    const nextOptions = ['A', 'B', 'C'].map(s => `<option value="${s}" ${s === nextVal ? 'selected' : ''}>${s}</option>`).join('');
    const zOptions = ['0', '1'].map(v => `<option value="${v}" ${v === zVal ? 'selected' : ''}>${v}</option>`).join('');

    tr.innerHTML = `
        <td class="fixed-cell">${fixedInputs[i].present}</td>
        <td class="fixed-cell">${fixedInputs[i].x}</td>
        <td><select id="next_${i}" class="cell-select" onchange="generateSystem()">${nextOptions}</select></td>
        <td><select id="z_${i}" class="cell-select" onchange="syncMooreZ(${i})">${zOptions}</select></td>
    `;
    return tr;
}

function loadExample() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((_, i) => tbody.appendChild(buildTableRow(i, defaultOutputs[i].next, defaultOutputs[i].z)));
    toggleModelType();
}

function clearTable() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((_, i) => tbody.appendChild(buildTableRow(i, 'A', '0')));
    toggleModelType();
}

// ============================================================
// § 運算與化簡邏輯
// ============================================================

function readTruthTable() {
    let tt = Array(8).fill(null).map(() => ({ q1: 'X', q0: 'X', x: 'X', nq1: 'X', nq0: 'X', z: 'X' }));
    for (let i = 0; i < 6; i++) {
        const pres   = fixedInputs[i].present;
        const xVal   = parseInt(fixedInputs[i].x, 10);
        const nextSt = document.getElementById(`next_${i}`).value;  
        const zVal   = parseInt(document.getElementById(`z_${i}`).value, 10); 
        const q   = stateCode[pres];    
        const nq  = stateCode[nextSt];  
        const index = (q[0] << 2) | (q[1] << 1) | xVal;
        tt[index] = { q1: q[0], q0: q[1], x: xVal, nq1: nq[0], nq0: nq[1], z: zVal };
    }
    return tt;
}

function calculateExcitation(tt, ffType) {
    let ex = { J1: [], K1: [], J0: [], K0: [], D1: [], D0: [], Z: [] };
    for (let i = 0; i < 8; i++) {
        const row = tt[i];
        if (row.nq1 === 'X') {
            ['J1','K1','J0','K0','D1','D0','Z'].forEach(k => ex[k].push('X'));
            continue;
        }
        ex.Z.push(row.z);
        if (ffType === 'd') {
            ex.D1.push(row.nq1); ex.D0.push(row.nq0);
            ex.J1.push('X'); ex.K1.push('X'); ex.J0.push('X'); ex.K0.push('X');
        } else {
            ex.J1.push(row.q1 === 0 ? row.nq1 : 'X'); ex.K1.push(row.q1 === 1 ? (1 - row.nq1): 'X');
            ex.J0.push(row.q0 === 0 ? row.nq0 : 'X'); ex.K0.push(row.q0 === 1 ? (1 - row.nq0): 'X');
            ex.D1.push('X'); ex.D0.push('X');
        }
    }
    return ex;
}

function minimizeLogic(ex, ffType) {
    const implicants = [
        { term: "1",        mask: 0b000, val: 0b000, size: 8 },
        { term: "Q1",       mask: 0b100, val: 0b100, size: 4 }, { term: "Q1'",      mask: 0b100, val: 0b000, size: 4 },
        { term: "Q0",       mask: 0b010, val: 0b010, size: 4 }, { term: "Q0'",      mask: 0b010, val: 0b000, size: 4 },
        { term: "X",        mask: 0b001, val: 0b001, size: 4 }, { term: "X'",       mask: 0b001, val: 0b000, size: 4 },
        { term: "Q1·Q0",    mask: 0b110, val: 0b110, size: 2 }, { term: "Q1·Q0'",   mask: 0b110, val: 0b100, size: 2 },
        { term: "Q1'·Q0",   mask: 0b110, val: 0b010, size: 2 }, { term: "Q1'·Q0'",  mask: 0b110, val: 0b000, size: 2 },
        { term: "Q1·X",     mask: 0b101, val: 0b101, size: 2 }, { term: "Q1·X'",    mask: 0b101, val: 0b100, size: 2 },
        { term: "Q1'·X",    mask: 0b101, val: 0b001, size: 2 }, { term: "Q1'·X'",   mask: 0b101, val: 0b000, size: 2 },
        { term: "Q0·X",     mask: 0b011, val: 0b011, size: 2 }, { term: "Q0·X'",    mask: 0b011, val: 0b010, size: 2 },
        { term: "Q0'·X",    mask: 0b011, val: 0b001, size: 2 }, { term: "Q0'·X'",   mask: 0b011, val: 0b000, size: 2 },
        { term: "Q1·Q0·X",  mask: 0b111, val: 0b111, size: 1 }, { term: "Q1·Q0·X'", mask: 0b111, val: 0b110, size: 1 },
        { term: "Q1·Q0'·X", mask: 0b111, val: 0b101, size: 1 }, { term: "Q1·Q0'·X'",mask: 0b111, val: 0b100, size: 1 },
        { term: "Q1'·Q0·X", mask: 0b111, val: 0b011, size: 1 }, { term: "Q1'·Q0·X'",mask: 0b111, val: 0b010, size: 1 },
        { term: "Q1'·Q0'·X",mask: 0b111, val: 0b001, size: 1 }, { term: "Q1'·Q0'·X'",mask: 0b111, val: 0b000, size: 1 },
    ];

    function solve(truthArr) {
        const ones = [], dcs = [];
        for (let i = 0; i < 8; i++) {
            if (truthArr[i] == 1)    ones.push(i);
            if (truthArr[i] === 'X') dcs.push(i);
        }
        if (ones.length === 0) return "0";
        if (ones.length + dcs.length === 8) return "1";

        const selected = [];
        const covered  = new Set();
        while (covered.size < ones.length) {
            let bestImp = null, bestCover = [];
            for (const imp of implicants) {
                const currentCover = [];
                let valid = true;
                for (let i = 0; i < 8; i++) {
                    if ((i & imp.mask) === imp.val) {
                        if (truthArr[i] == 0) { valid = false; break; }
                        if (truthArr[i] == 1 && !covered.has(i)) currentCover.push(i);
                    }
                }
                if (valid && (currentCover.length > bestCover.length || (currentCover.length === bestCover.length && bestImp && imp.size > bestImp.size))) {
                    bestImp = imp; bestCover = currentCover;
                }
            }
            if (!bestImp) break;
            selected.push(bestImp.term);
            bestCover.forEach(idx => covered.add(idx));
        }
        return selected.length > 0 ? selected.join(" + ") : "0";
    }

    const eq = {};
    if (ffType === 'jk') {
        eq.J1 = solve(ex.J1); eq.K1 = solve(ex.K1); eq.J0 = solve(ex.J0); eq.K0 = solve(ex.K0);
    } else {
        eq.D1 = solve(ex.D1); eq.D0 = solve(ex.D0);
    }
    eq.Z = solve(ex.Z);
    return eq;
}

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
// § Output 1 渲染
// ============================================================

function renderOutput1(eq, ffType) {
    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = '';
    const keys = ffType === 'jk' ? ['J1', 'K1', 'J0', 'K0'] : ['D1', 'D0'];
    keys.forEach(k => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>FF for Q${k.charAt(1)}</td><td style="font-weight:bold;">${k}</td><td style="color:#2563eb; font-weight:bold; font-family:monospace;">${k} = ${eq[k]}</td>`;
        tbody.appendChild(tr);
    });

    let selectHTML = `<select class="kmap-select" onchange="updateKMap(this.value)">`;
    keys.forEach(k => selectHTML += `<option value="${k}">K-Map for ${k}</option>`);
    selectHTML += `<option value="Z">K-Map for Z</option></select>`;
    document.getElementById('kmap-container').innerHTML = `<div style="text-align:center; margin-bottom:10px;"><label style="font-weight:600; color:#475569;">Select Input / Output:</label> ${selectHTML}</div><div id="kmap-visual-box"></div>`;
    updateKMap(keys[0]);
}

function updateKMap(selectedKey) {
    if (!currentExcitation || !currentEquations) return;
    const arr   = currentExcitation[selectedKey];
    const eqStr = currentEquations[selectedKey];
    function cellStyle(val) {
        if (val == 1) return 'background:#dcfce7; color:#15803d; font-weight:bold;';
        if (val === 'X') return 'background:#fef9c3; color:#92400e;';
        return 'color:#94a3b8;';
    }
    const rows = [{ label: '0', idxs: [0, 1, 3, 2] }, { label: '1', idxs: [4, 5, 7, 6] }];
    let tableHTML = `<table style="width:90%; margin:auto; border-collapse:collapse; text-align:center; font-size:0.9rem;"><tr><th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">Q1 \\ Q0X</th><th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">00</th><th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">01</th><th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">11</th><th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">10</th></tr>`;
    rows.forEach(r => {
        tableHTML += `<tr><th style="background:#f1f5f9; padding:6px 8px; border:1px solid #cbd5e1;">${r.label}</th>`;
        r.idxs.forEach(i => tableHTML += `<td style="${cellStyle(arr[i])} padding:6px 8px; border:1px solid #cbd5e1;">${arr[i] === 'X' ? 'X' : arr[i]}</td>`);
        tableHTML += `</tr>`;
    });
    tableHTML += `</table><p style="margin-top:10px; text-align:center; font-size:1.05rem; color:#16a34a; font-weight:bold; font-family:monospace;">(Simplified) ${selectedKey} = ${eqStr}</p>`;
    document.getElementById('kmap-visual-box').innerHTML = tableHTML;
}

// ============================================================
// § Canvas 平移縮放引擎
// ============================================================

function initCanvasEvents() {
    const canvas = document.getElementById('circuitCanvas');
    canvas.addEventListener('mousedown', e => {
        isDragging = true; dragStartX = e.clientX - offsetX; dragStartY = e.clientY - offsetY; canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
        if (!isDragging) return; offsetX = e.clientX - dragStartX; offsetY = e.clientY - dragStartY; redrawCircuit();
    });
    window.addEventListener('mouseup', () => { isDragging = false; canvas.style.cursor = 'grab'; });
}
function zoomCanvas(delta) { canvasScale = Math.min(2.5, Math.max(0.4, canvasScale + delta)); redrawCircuit(); }
function resetZoom() { canvasScale = 1.0; offsetX = 0; offsetY = 0; redrawCircuit(); }
function redrawCircuit() {
    if (!currentEquations) return;
    drawDynamicCircuit(currentEquations, document.querySelector('input[name="ffType"]:checked').value, document.querySelector('input[name="modelType"]:checked').value);
}

// ============================================================
// § 電路佈線繪製引擎 (Output 2) - 斷線終極修正版
// ============================================================

const BUS = { X: 30, Xn: 55, Q1: 80, Q1n: 105, Q0: 130, Q0n: 155 };
const BUS_KEY = { "X": "X", "X'": "Xn", "Q1": "Q1", "Q1'": "Q1n", "Q0": "Q0", "Q0'": "Q0n" };

function drawDynamicCircuit(eq, ffType, modelType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx    = canvas.getContext('2d');

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
    ctx.scale(canvasScale, canvasScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5; ctx.fillStyle = '#1e293b'; ctx.font = 'bold 11px Courier New';

    const W = canvas.width, BUS_L = 18;
    const BUS_R = W - 30; // 匯流排右端點 (延伸到底部確保所有閘門都能接到)

    const FF1 = { x: 270, y: 220 }, FF2 = { x: 490, y: 220 }, FF_W = 65, FF_H = 110;

    // 1. 輸入匯流排
    ctx.fillText("X", 3, BUS.X + 4); drawHLine(ctx, BUS_L, BUS_R, BUS.X);
    const notTapX = 55; drawDot(ctx, notTapX, BUS.X); drawVLine(ctx, notTapX, BUS.X, BUS.X + 20); drawNOTGate(ctx, notTapX - 8, BUS.X + 20);
    drawHLine(ctx, notTapX + 22, BUS_R, BUS.Xn); drawHLine(ctx, BUS_L, notTapX - 8, BUS.Xn); ctx.fillText("X'", 3, BUS.Xn + 4);

    if (ffType === 'jk') { drawJKFlipFlop(ctx, FF1.x, FF1.y, "Q1"); drawJKFlipFlop(ctx, FF2.x, FF2.y, "Q0"); } 
    else { drawDFlipFlop(ctx, FF1.x, FF1.y, "Q1"); drawDFlipFlop(ctx, FF2.x, FF2.y, "Q0"); }

    // 2. Q/Q' 回授匯流排 (修正斷線：水平線延伸到 BUS_R)
    const q1QOutX = FF1.x + FF_W, q1QOutY = FF1.y + 35, q1QTapX = q1QOutX + 15;
    drawHLine(ctx, q1QOutX, q1QTapX, q1QOutY); drawVLine(ctx, q1QTapX, BUS.Q1, q1QOutY); drawHLine(ctx, BUS_L, BUS_R, BUS.Q1); drawDot(ctx, q1QTapX, BUS.Q1); ctx.fillText("Q1", 3, BUS.Q1 + 4);

    const q1QnOutY = FF1.y + 75, q1QnTapX = q1QTapX + 12;
    drawHLine(ctx, q1QOutX, q1QnTapX, q1QnOutY); drawVLine(ctx, q1QnTapX, BUS.Q1n, q1QnOutY); drawHLine(ctx, BUS_L, BUS_R, BUS.Q1n); drawDot(ctx, q1QnTapX, BUS.Q1n); ctx.fillText("Q1'", 3, BUS.Q1n + 4);

    const q0QOutX = FF2.x + FF_W, q0QOutY = FF2.y + 35, q0QTapX = q0QOutX + 15;
    drawHLine(ctx, q0QOutX, q0QTapX, q0QOutY); drawVLine(ctx, q0QTapX, BUS.Q0, q0QOutY); drawHLine(ctx, BUS_L, BUS_R, BUS.Q0); drawDot(ctx, q0QTapX, BUS.Q0); ctx.fillText("Q0", 3, BUS.Q0 + 4);

    const q0QnOutY = FF2.y + 75, q0QnTapX = q0QTapX + 12;
    drawHLine(ctx, q0QOutX, q0QnTapX, q0QnOutY); drawVLine(ctx, q0QnTapX, BUS.Q0n, q0QnOutY); drawHLine(ctx, BUS_L, BUS_R, BUS.Q0n); drawDot(ctx, q0QnTapX, BUS.Q0n); ctx.fillText("Q0'", 3, BUS.Q0n + 4);

    // 3. CLK 匯流排
    const clkY = FF1.y + FF_H + 50; ctx.fillText("CLK", 3, clkY + 4); drawHLine(ctx, BUS_L, BUS_R, clkY);
    const ff1ClkX = FF1.x + 30, ff2ClkX = FF2.x + 30;
    drawVLine(ctx, ff1ClkX, FF1.y + FF_H, clkY); drawDot(ctx, ff1ClkX, clkY); drawVLine(ctx, ff2ClkX, FF2.y + FF_H, clkY); drawDot(ctx, ff2ClkX, clkY);

    // 4. 解析接線
    if (ffType === 'jk') {
        parseAndRouteGate(ctx, eq.J1, FF1.x, FF1.y + 35, FF1.x - 60); parseAndRouteGate(ctx, eq.K1, FF1.x, FF1.y + 75, FF1.x - 60);
        parseAndRouteGate(ctx, eq.J0, FF2.x, FF2.y + 35, FF2.x - 60); parseAndRouteGate(ctx, eq.K0, FF2.x, FF2.y + 75, FF2.x - 60);
    } else {
        parseAndRouteGate(ctx, eq.D1, FF1.x, FF1.y + 55, FF1.x - 60); parseAndRouteGate(ctx, eq.D0, FF2.x, FF2.y + 55, FF2.x - 60);
    }

    // 5. Z 輸出佈線 (畫在最右側)
    const zGateX = BUS_R - 80, zPinY = FF2.y + 55;
    parseAndRouteGate(ctx, eq.Z, zGateX, zPinY, zGateX - 60);
    drawHLine(ctx, zGateX, zGateX + 30, zPinY);
    ctx.fillStyle = '#dc2626'; ctx.font = 'bold 15px Courier New'; ctx.fillText("Z", zGateX + 35, zPinY + 5); ctx.fillStyle = '#1e293b'; ctx.font = 'bold 11px Courier New';
}

function parseAndRouteGate(ctx, eqStr, pinX, pinY, gateOutX) {
    if (!eqStr) return;
    if (eqStr === "0") { ctx.fillText("GND", gateOutX - 35, pinY + 4); drawHLine(ctx, gateOutX - 5, pinX, pinY); return; }
    if (eqStr === "1") { ctx.fillText("VCC", gateOutX - 35, pinY + 4); drawHLine(ctx, gateOutX - 5, pinX, pinY); return; }

    const SIG_ORDER = ["Q1'", "Q0'", "X'", "Q1", "Q0", "X"];
    const foundSigs = []; let tempEq = eqStr;
    SIG_ORDER.forEach(s => { if (tempEq.includes(s)) { foundSigs.push(s); tempEq = tempEq.split(s).join(""); } });

    if (foundSigs.length === 0) { ctx.fillText(eqStr, gateOutX - 30, pinY + 4); drawHLine(ctx, gateOutX, pinX, pinY); return; }

    const isOR = eqStr.includes("+"), isAND = eqStr.includes("·") || (foundSigs.length > 1 && !isOR);
    const GATE_W = 32, gateBodyX = gateOutX - GATE_W;

    if (foundSigs.length === 1) {
        connectBusToPin(ctx, foundSigs[0], gateOutX, pinY); drawHLine(ctx, gateOutX, pinX, pinY);
    } else if (foundSigs.length === 2 && !isOR) {
        drawANDGate(ctx, gateBodyX, pinY - 15); routeToGatePin(ctx, foundSigs[0], gateBodyX, pinY - 8); routeToGatePin(ctx, foundSigs[1], gateBodyX, pinY + 5); drawHLine(ctx, gateOutX, pinX, pinY);
    } else if (foundSigs.length === 2 && isOR) {
        drawORGate(ctx, gateBodyX, pinY - 15); routeToGatePin(ctx, foundSigs[0], gateBodyX, pinY - 8); routeToGatePin(ctx, foundSigs[1], gateBodyX, pinY + 5); drawHLine(ctx, gateOutX, pinX, pinY);
    } else {
        ctx.strokeRect(gateBodyX - 5, pinY - 20, GATE_W + 10, 40); ctx.fillText("f()", gateBodyX, pinY + 4);
        const step = 36 / Math.max(foundSigs.length - 1, 1);
        foundSigs.forEach((sig, idx) => {
            const iy = (pinY - 16) + idx * step, dropX = gateBodyX - 15 - idx * 6;
            connectBusToPin(ctx, sig, dropX, iy); drawHLine(ctx, dropX, gateBodyX - 5, iy);
        });
        drawHLine(ctx, gateOutX, pinX, pinY);
    }
}

function connectBusToPin(ctx, sigName, tapX, targetY) {
    const busKey = BUS_KEY[sigName]; if (!busKey) return;
    drawVLine(ctx, tapX, BUS[busKey], targetY); drawDot(ctx, tapX, BUS[busKey]);
}
function routeToGatePin(ctx, sigName, gateX, inputY) {
    const busKey = BUS_KEY[sigName]; if (!busKey) return;
    const offset = (Object.keys(BUS_KEY).indexOf(sigName) % 4) * 5, tapX = gateX - 20 - offset;
    drawVLine(ctx, tapX, BUS[busKey], inputY); drawDot(ctx, tapX, BUS[busKey]); drawHLine(ctx, tapX, gateX, inputY);
}

// ============================================================
// § 幾何繪圖元件
// ============================================================

function drawHLine(ctx, x1, x2, y) { ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
function drawVLine(ctx, x, y1, y2) { ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke(); }
function drawDot(ctx, x, y) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }

function drawNOTGate(ctx, x, y) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 8); ctx.lineTo(x, y + 16); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 19, y + 8, 3, 0, Math.PI * 2); ctx.stroke(); }
function drawJKFlipFlop(ctx, x, y, label) { const W = 65, H = 110; ctx.strokeRect(x, y, W, H); ctx.fillText("J", x + 5, y + 39); ctx.fillText("K", x + 5, y + 79); ctx.fillText("Q", x + W - 20, y + 39); ctx.fillText("Q'", x + W - 22, y + 79); ctx.fillText(label, x + 20, y - 8); ctx.beginPath(); ctx.moveTo(x + 25, y + H); ctx.lineTo(x + 32, y + H - 10); ctx.lineTo(x + 39, y + H); ctx.stroke(); drawHLine(ctx, x - 10, x, y + 35); drawHLine(ctx, x - 10, x, y + 75); }
function drawDFlipFlop(ctx, x, y, label) { const W = 65, H = 110; ctx.strokeRect(x, y, W, H); ctx.fillText("D", x + 5, y + 59); ctx.fillText("Q", x + W - 20, y + 39); ctx.fillText("Q'", x + W - 22, y + 79); ctx.fillText(label, x + 20, y - 8); ctx.beginPath(); ctx.moveTo(x + 25, y + H); ctx.lineTo(x + 32, y + H - 10); ctx.lineTo(x + 39, y + H); ctx.stroke(); drawHLine(ctx, x - 10, x, y + 55); }
function drawANDGate(ctx, x, y) { const W = 30, H = 28; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + W / 2, y); ctx.arc(x + W / 2, y + H / 2, H / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x, y + H); ctx.closePath(); ctx.stroke(); }
function drawORGate(ctx, x, y) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y, x + 30, y + 14); ctx.quadraticCurveTo(x + 12, y + 28, x, y + 28); ctx.quadraticCurveTo(x + 8, y + 14, x, y); ctx.stroke(); }

function downloadPNG() { const link = document.createElement('a'); link.download = 'Sequential_Circuit.png'; link.href = document.getElementById('circuitCanvas').toDataURL('image/png'); link.click(); }
function exportPDF() { html2pdf().set({ margin: 8, filename: '期末專題報告_Sequential_Circuit.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(document.body).save(); }
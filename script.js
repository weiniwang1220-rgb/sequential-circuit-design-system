// ========================================================
// 1. 全局參數與狀態管理
// ========================================================
const fixedInputs = [
    { present: 'A', x: '0' }, { present: 'A', x: '1' },
    { present: 'B', x: '0' }, { present: 'B', x: '1' },
    { present: 'C', x: '0' }, { present: 'C', x: '1' }
];
const defaultOutputs = [
    { next: 'A', z: '0' }, { next: 'B', z: '0' },
    { next: 'C', z: '1' }, { next: 'A', z: '0' },
    { next: 'A', z: '1' }, { next: 'C', z: '1' }
];
const stateCode = { 'A': [0, 0], 'B': [0, 1], 'C': [1, 0] };

// Canvas 縮放與平移(拖曳)變數
let canvasScale = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

let currentEquations = null; 
let currentExcitation = null; 

window.onload = function() {
    loadExample(); 
    initCanvasEvents(); // 啟動滑鼠拖曳監聽
};

// ========================================================
// 2. 表格載入與讀取邏輯
// ========================================================
function loadExample() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fixed-cell">${row.present}</td>
            <td class="fixed-cell">${row.x}</td>
            <td><input type="text" id="next_${i}" class="cell-input" value="${defaultOutputs[i].next}"></td>
            <td><input type="text" id="z_${i}" class="cell-input" value="${defaultOutputs[i].z}"></td>
        `;
        tbody.appendChild(tr);
    });
    generateSystem();
}

function clearTable() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fixed-cell">${row.present}</td>
            <td class="fixed-cell">${row.x}</td>
            <td><input type="text" id="next_${i}" class="cell-input" value="" placeholder="-"></td>
            <td><input type="text" id="z_${i}" class="cell-input" value="" placeholder="-"></td>
        `;
        tbody.appendChild(tr);
    });
    generateSystem(); 
}

function readTruthTable() {
    let tt = Array(8).fill(null); 
    tt[6] = { nq1: 'X', nq0: 'X', z: 'X' };
    tt[7] = { nq1: 'X', nq0: 'X', z: 'X' };

    for(let i=0; i<6; i++) {
        const pres = fixedInputs[i].present;
        const x = parseInt(fixedInputs[i].x);
        const nextVal = document.getElementById(`next_${i}`).value.toUpperCase().trim();
        const zVal = document.getElementById(`z_${i}`).value.trim();
        
        const q = stateCode[pres];
        const nq = stateCode[nextVal]; 
        
        let nq1 = 'X', nq0 = 'X';
        if (nq) { nq1 = nq[0]; nq0 = nq[1]; }
        let z = 'X';
        if (zVal === '0') z = 0;
        if (zVal === '1') z = 1;
        
        const index = (q[0] << 2) | (q[1] << 1) | x;
        tt[index] = { q1: q[0], q0: q[1], x: x, nq1: nq1, nq0: nq0, z: z };
    }
    return tt;
}

// ========================================================
// 3. 布林邏輯化簡與 Output 1
// ========================================================
function generateSystem() {
    const ffType = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    
    const truthTable = readTruthTable();
    currentExcitation = calculateExcitation(truthTable, ffType);
    currentEquations = minimizeLogic(currentExcitation, ffType);
    
    renderOutput1(currentEquations, ffType);
    drawDynamicCircuit(currentEquations, ffType, modelType);
}

function calculateExcitation(tt, ffType) {
    let ex = { J1: [], K1: [], J0: [], K0: [], D1: [], D0: [], Z: [] };
    for(let i=0; i<8; i++) {
        let row = tt[i];
        if (row.nq1 === 'X') {
            ['J1','K1','J0','K0','D1','D0','Z'].forEach(k => ex[k].push('X'));
            continue;
        }
        ex.Z.push(row.z);
        if (ffType === 'd') {
            ex.D1.push(row.nq1); ex.D0.push(row.nq0);
        } else {
            ex.J1.push(row.q1 === 0 ? row.nq1 : 'X');
            ex.K1.push(row.q1 === 1 ? (1 - row.nq1) : 'X');
            ex.J0.push(row.q0 === 0 ? row.nq0 : 'X');
            ex.K0.push(row.q0 === 1 ? (1 - row.nq0) : 'X');
        }
    }
    return ex;
}

function minimizeLogic(ex, ffType) {
    const implicants = [
        { term: "1", mask: 0b000, val: 0b000, size: 8 },
        { term: "Q1", mask: 0b100, val: 0b100, size: 4 }, { term: "Q1'", mask: 0b100, val: 0b000, size: 4 },
        { term: "Q0", mask: 0b010, val: 0b010, size: 4 }, { term: "Q0'", mask: 0b010, val: 0b000, size: 4 },
        { term: "X",  mask: 0b001, val: 0b001, size: 4 }, { term: "X'",  mask: 0b001, val: 0b000, size: 4 },
        { term: "Q1·Q0", mask: 0b110, val: 0b110, size: 2 }, { term: "Q1·Q0'", mask: 0b110, val: 0b100, size: 2 },
        { term: "Q1'·Q0", mask: 0b110, val: 0b010, size: 2 }, { term: "Q1'·Q0'", mask: 0b110, val: 0b000, size: 2 },
        { term: "Q1·X", mask: 0b101, val: 0b101, size: 2 }, { term: "Q1·X'", mask: 0b101, val: 0b100, size: 2 },
        { term: "Q1'·X", mask: 0b101, val: 0b001, size: 2 }, { term: "Q1'·X'", mask: 0b101, val: 0b000, size: 2 },
        { term: "Q0·X", mask: 0b011, val: 0b011, size: 2 }, { term: "Q0·X'", mask: 0b011, val: 0b010, size: 2 },
        { term: "Q0'·X", mask: 0b011, val: 0b001, size: 2 }, { term: "Q0'·X'", mask: 0b011, val: 0b000, size: 2 },
        { term: "Q1·Q0·X", mask: 0b111, val: 0b111, size: 1 }, { term: "Q1'·Q0'·X'", mask: 0b111, val: 0b000, size: 1 }
    ];

    function solve(truthArr) {
        let ones = [], dcs = [];
        for(let i=0; i<8; i++) {
            if(truthArr[i] == 1) ones.push(i);
            if(truthArr[i] === 'X') dcs.push(i);
        }
        if (ones.length === 0) return "0";
        if (ones.length + dcs.length === 8) return "1";

        let selected = [];
        let covered = new Set();
        while(covered.size < ones.length) {
            let bestImp = null, bestCover = [];
            for (let imp of implicants) {
                let currentCover = [];
                let valid = true;
                for (let i=0; i<8; i++) {
                    if ((i & imp.mask) === imp.val) {
                        if (truthArr[i] == 0) { valid = false; break; }
                        if (truthArr[i] == 1 && !covered.has(i)) currentCover.push(i);
                    }
                }
                if (valid && currentCover.length > (bestCover ? bestCover.length : 0)) {
                    bestImp = imp; bestCover = currentCover;
                }
            }
            if (!bestImp) break;
            selected.push(bestImp.term);
            bestCover.forEach(idx => covered.add(idx));
        }
        return selected.join(" + ");
    }

    let eq = {};
    if(ffType === 'jk') {
        eq.J1 = solve(ex.J1); eq.K1 = solve(ex.K1);
        eq.J0 = solve(ex.J0); eq.K0 = solve(ex.K0);
    } else {
        eq.D1 = solve(ex.D1); eq.D0 = solve(ex.D0);
    }
    eq.Z = solve(ex.Z);
    return eq;
}

function renderOutput1(eq, ffType) {
    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = '';
    let keys = ffType === 'jk' ? ['J1','K1','J0','K0'] : ['D1','D0'];
    keys.forEach(k => {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>FF for ${k.charAt(1)}</td><td style="font-weight:bold;">${k}</td><td style="color:#2563eb; font-weight:bold;">${k} = ${eq[k]}</td>`;
        tbody.appendChild(tr);
    });

    let selectHTML = `<select class="kmap-select" onchange="updateKMap(this.value)">`;
    keys.forEach(k => { selectHTML += `<option value="${k}">K-Map for ${k}</option>`; });
    selectHTML += `<option value="Z">K-Map for Z</option></select>`;

    document.getElementById('kmap-container').innerHTML = `
        <div style="text-align:center; margin-bottom:10px;">
            <label style="font-weight:600; color:#475569;">Select Input / Output: </label>${selectHTML}
        </div>
        <div id="kmap-visual-box"></div>
    `;
    updateKMap(keys[0]);
}

function updateKMap(selectedKey) {
    if (!currentExcitation || !currentEquations) return;
    const arr = currentExcitation[selectedKey];
    const eqStr = currentEquations[selectedKey];
    document.getElementById('kmap-visual-box').innerHTML = `
        <table style="width:80%; margin:auto; background: #ffffff; text-align:center;">
            <tr><th>Q1 \\ Q0 X</th><th>00</th><th>01</th><th>11</th><th>10</th></tr>
            <tr><th>0</th><td>${arr[0]}</td><td>${arr[1]}</td><td>${arr[3]}</td><td>${arr[2]}</td></tr>
            <tr><th>1</th><td>${arr[4]}</td><td>${arr[5]}</td><td>${arr[7]}</td><td>${arr[6]}</td></tr>
        </table>
        <p style="margin-top:8px; text-align:center; font-size:1.1rem; color:#16a34a; font-weight:bold;">${selectedKey} = ${eqStr}</p>
    `;
}

// ========================================================
// 4. Canvas 平移與縮放互動 (Pan & Zoom)
// ========================================================
function initCanvasEvents() {
    const canvas = document.getElementById('circuitCanvas');
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX - offsetX;
        dragStartY = e.clientY - offsetY;
        canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            offsetX = e.clientX - dragStartX;
            offsetY = e.clientY - dragStartY;
            redrawCircuit();
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; canvas.style.cursor = 'grab'; });
}

function zoomCanvas(delta) {
    canvasScale += delta;
    if (canvasScale < 0.5) canvasScale = 0.5;
    if (canvasScale > 2.5) canvasScale = 2.5;
    redrawCircuit();
}

function resetZoom() {
    canvasScale = 1.0;
    offsetX = 0;
    offsetY = 0;
    redrawCircuit();
}

function redrawCircuit() {
    if (!currentEquations) return;
    const ffType = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    drawDynamicCircuit(currentEquations, ffType, modelType);
}

// ========================================================
// 5. 絕對不斷線：佈線繪圖引擎 (Output 2)
// ========================================================
const busRails = { "X": 30, "X'": 50, "Q1": 70, "Q1'": 90, "Q0": 110, "Q0'": 130 };

function drawDynamicCircuit(eq, ffType, modelType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx = canvas.getContext('2d');
    
    // 實施縮放與平移變換
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
    ctx.scale(canvasScale, canvasScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5; ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px Courier New';

    const lineMaxX = 720; // 延長主線以容納 Z 輸出

    // 1. 繪製匯流排 (X, X')
    ctx.fillText("X", 5, 34); ctx.beginPath(); ctx.moveTo(25, 30); ctx.lineTo(lineMaxX, 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, 30); ctx.lineTo(40, 50); ctx.lineTo(50, 50); ctx.stroke(); drawDot(ctx, 40, 30);
    drawNOTGate(ctx, 50, 45); ctx.beginPath(); ctx.moveTo(70, 50); ctx.lineTo(lineMaxX, 50); ctx.stroke(); ctx.fillText("X'", 5, 54);

    // FF 座標
    const q1X = 280, q1Y = 200;
    const q0X = 480, q0Y = 200;

    // 2. 繪製回授線路 (Q 到 Bus)
    ctx.beginPath(); ctx.moveTo(q1X+60, q1Y+30); ctx.lineTo(q1X+80, q1Y+30); ctx.lineTo(q1X+80, 70); ctx.lineTo(25, 70); ctx.stroke(); ctx.fillText("Q1", 5, 74);
    ctx.beginPath(); ctx.moveTo(q1X+60, q1Y+90); ctx.lineTo(q1X+70, q1Y+90); ctx.lineTo(q1X+70, 90); ctx.lineTo(25, 90); ctx.stroke(); ctx.fillText("Q1'", 5, 94);
    ctx.beginPath(); ctx.moveTo(q0X+60, q0Y+30); ctx.lineTo(q0X+80, q0Y+30); ctx.lineTo(q0X+80, 110); ctx.lineTo(25, 110); ctx.stroke(); ctx.fillText("Q0", 5, 114);
    ctx.beginPath(); ctx.moveTo(q0X+60, q0Y+90); ctx.lineTo(q0X+70, q0Y+90); ctx.lineTo(q0X+70, 130); ctx.lineTo(25, 130); ctx.stroke(); ctx.fillText("Q0'", 5, 134);

    // 3. 繪製時脈 CLK (無縫對齊底部)
    const clkY = 400;
    ctx.fillText("CLK", 5, clkY+4); ctx.beginPath(); ctx.moveTo(25, clkY); ctx.lineTo(lineMaxX, clkY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(q1X+30, clkY); ctx.lineTo(q1X+30, q1Y+100); ctx.stroke(); drawDot(ctx, q1X+30, clkY);
    ctx.beginPath(); ctx.moveTo(q0X+30, clkY); ctx.lineTo(q0X+30, q0Y+100); ctx.stroke(); drawDot(ctx, q0X+30, clkY);

    // 4. 正反器與解析接線 (無縫計算)
    if(ffType === 'jk') {
        drawJKFlipFlop(ctx, q1X, q1Y, "Q1"); drawJKFlipFlop(ctx, q0X, q0Y, "Q0");
        parseAndRouteGate(ctx, eq.J1, q1X, q1Y+30, q1X-50);
        parseAndRouteGate(ctx, eq.K1, q1X, q1Y+90, q1X-50);
        parseAndRouteGate(ctx, eq.J0, q0X, q0Y+30, q0X-50);
        parseAndRouteGate(ctx, eq.K0, q0X, q0Y+90, q0X-50);
    } else {
        drawDFlipFlop(ctx, q1X, q1Y, "Q1"); drawDFlipFlop(ctx, q0X, q0Y, "Q0");
        parseAndRouteGate(ctx, eq.D1, q1X, q1Y+50, q1X-50);
        parseAndRouteGate(ctx, eq.D0, q0X, q0Y+50, q0X-50);
    }

    // 5. 新增：輸出 Z 佈線與閘門 (依據真實計算出的 eq.Z)
    const zPinX = 660, zPinY = 250;
    parseAndRouteGate(ctx, eq.Z, zPinX, zPinY, zPinX - 50);
    ctx.beginPath(); ctx.moveTo(zPinX, zPinY); ctx.lineTo(zPinX + 25, zPinY); ctx.stroke();
    ctx.fillStyle = '#ea580c'; ctx.fillText("Z", zPinX + 30, zPinY + 4);
}

// 無縫動態佈線核心：完美計算引線與閘門座標避免斷線
function parseAndRouteGate(ctx, eq, pinX, pinY, gateOutX) {
    // 嚴格依序解析，避免部分匹配錯誤
    const signals = ["Q1'", "Q1", "Q0'", "Q0", "X'", "X"];
    let foundSigs = [], tempEq = eq;
    signals.forEach(s => { if(tempEq.includes(s)) { foundSigs.push(s); tempEq = tempEq.replace(s, ""); } });

    if (foundSigs.length === 0) { 
        ctx.beginPath(); ctx.moveTo(pinX-30, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
        ctx.fillText(eq.includes("1") ? "VCC" : "GND", pinX - 55, pinY + 4); return;
    }

    let isOR = eq.includes("+"), isAND = eq.includes("·") || (foundSigs.length > 1 && !isOR);
    const gateX = gateOutX - 30; // 邏輯閘左側座標

    if (foundSigs.length === 1) {
        // 直連 (Line)
        connectToBus(ctx, foundSigs[0], gateOutX, pinY); 
        ctx.beginPath(); ctx.moveTo(gateOutX, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
    } else if (foundSigs.length === 2 && isOR && !isAND) {
        // 2 輸入 OR
        drawORGate(ctx, gateX, pinY - 15, "OR");
        routeToGateInput(ctx, foundSigs[0], gateX - 10, gateX, pinY - 7);
        routeToGateInput(ctx, foundSigs[1], gateX - 5, gateX, pinY + 7);
        ctx.beginPath(); ctx.moveTo(gateOutX, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
    } else if (foundSigs.length === 2 && isAND && !isOR) {
        // 2 輸入 AND
        drawANDGate(ctx, gateX, pinY - 15, "AND");
        routeToGateInput(ctx, foundSigs[0], gateX - 10, gateX, pinY - 7);
        routeToGateInput(ctx, foundSigs[1], gateX - 5, gateX, pinY + 7);
        ctx.beginPath(); ctx.moveTo(gateOutX, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
    } else {
        // 複雜邏輯包裝區塊 (避免交叉混亂)
        ctx.strokeRect(gateX - 10, pinY - 20, 40, 40); ctx.fillText("f()", gateX, pinY + 4);
        let startY = pinY - 15, step = 30 / (foundSigs.length - 1 || 1);
        foundSigs.forEach((sig, idx) => {
            let y = startY + (step * idx), dropX = gateX - 25 - (idx * 5); 
            routeToGateInput(ctx, sig, dropX, gateX - 10, y);
        });
        ctx.beginPath(); ctx.moveTo(gateOutX, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
    }
}

// 輔助函式：繪製從 Bus 落下並無縫接軌到閘門輸入端的垂直水平線
function routeToGateInput(ctx, sig, dropX, targetX, targetY) {
    if (!busRails[sig]) return;
    ctx.beginPath(); ctx.moveTo(dropX, targetY); ctx.lineTo(dropX, busRails[sig]); ctx.stroke(); drawDot(ctx, dropX, busRails[sig]);
    ctx.beginPath(); ctx.moveTo(dropX, targetY); ctx.lineTo(targetX, targetY); ctx.stroke();
}

function connectToBus(ctx, sig, x, y) {
    if (!busRails[sig]) return;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, busRails[sig]); ctx.stroke(); drawDot(ctx, x, busRails[sig]);
}

// 繪圖基本元件
function drawDot(ctx, x, y) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
function drawNOTGate(ctx, x, y) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+15, y+5); ctx.lineTo(x, y+10); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(x+18, y+5, 3, 0, Math.PI*2); ctx.stroke(); }

function drawJKFlipFlop(ctx, x, y, label) { 
    ctx.strokeRect(x, y, 60, 100); 
    ctx.fillText("J", x + 5, y + 34); ctx.fillText("K", x + 5, y + 94); 
    ctx.fillText("Q", x + 45, y + 34); ctx.fillText("Q'", x + 40, y + 94); 
    ctx.fillText(label, x + 22, y - 8); 
    // CLK 三角形置底對齊
    ctx.beginPath(); ctx.moveTo(x+25, y+100); ctx.lineTo(x+30, y+90); ctx.lineTo(x+35, y+100); ctx.stroke(); 
}

function drawDFlipFlop(ctx, x, y, label) { 
    ctx.strokeRect(x, y, 60, 100); 
    ctx.fillText("D", x + 5, y + 54); 
    ctx.fillText("Q", x + 45, y + 34); ctx.fillText("Q'", x + 40, y + 94); 
    ctx.fillText(label, x + 22, y - 8); 
    ctx.beginPath(); ctx.moveTo(x+25, y+100); ctx.lineTo(x+30, y+90); ctx.lineTo(x+35, y+100); ctx.stroke(); 
}

function drawORGate(ctx, x, y, txt) { 
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x+15, y, x+30, y+15); ctx.quadraticCurveTo(x+15, y+30, x, y+30); ctx.quadraticCurveTo(x+10, y+15, x, y); ctx.stroke(); 
}

function drawANDGate(ctx, x, y, txt) { 
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+15, y); ctx.arc(x+15, y+15, 15, -Math.PI/2, Math.PI/2); ctx.lineTo(x, y+30); ctx.closePath(); ctx.stroke(); 
}

function downloadPNG() { const link = document.createElement('a'); link.download = 'Sequential_Circuit.png'; link.href = document.getElementById('circuitCanvas').toDataURL("image/png"); link.click(); }
function exportPDF() { html2pdf().set({ margin: 8, filename: '期末專題報告.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(document.body).save(); }
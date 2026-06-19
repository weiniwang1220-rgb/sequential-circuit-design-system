/**
 * Sequential Circuit Design Automation System
 * 具備動態邏輯演算 (Boolean Minimization) 與動態解析繪圖引擎
 */

// 定義系統固定的 Present State 與 X (符合專題要求：不可變動)
const fixedInputs = [
    { present: 'A', x: '0' }, { present: 'A', x: '1' },
    { present: 'B', x: '0' }, { present: 'B', x: '1' },
    { present: 'C', x: '0' }, { present: 'C', x: '1' }
];

// 預設的 Next State 與 Z
const defaultOutputs = [
    { next: 'A', z: '0' }, { next: 'B', z: '0' },
    { next: 'C', z: '1' }, { next: 'A', z: '0' },
    { next: 'A', z: '1' }, { next: 'C', z: '1' }
];

// 狀態編碼: A=00, B=01, C=10
const stateCode = { 'A': [0, 0], 'B': [0, 1], 'C': [1, 0] };

window.onload = function() {
    initTable();
    generateSystem();
};

// 建立具有防呆下拉選單的表格
function initTable() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    fixedInputs.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fixed-cell">${row.present}</td>
            <td class="fixed-cell">${row.x}</td>
            <td>
                <select id="next_${i}" class="cell-select">
                    <option value="A" ${defaultOutputs[i].next === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${defaultOutputs[i].next === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${defaultOutputs[i].next === 'C' ? 'selected' : ''}>C</option>
                </select>
            </td>
            <td>
                <select id="z_${i}" class="cell-select">
                    <option value="0" ${defaultOutputs[i].z === '0' ? 'selected' : ''}>0</option>
                    <option value="1" ${defaultOutputs[i].z === '1' ? 'selected' : ''}>1</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function resetTable() { initTable(); generateSystem(); }

// 系統核心主控台
function generateSystem() {
    const ffType = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    
    // 1. 從 UI 讀取真值表
    const truthTable = readTruthTable();
    
    // 2. 依據選擇的正反器類型，計算激勵真值表
    const excitation = calculateExcitation(truthTable, ffType);
    
    // 3. 進行布林邏輯最佳化 (化簡方程式)
    const equations = minimizeLogic(excitation, ffType);
    
    // 4. 更新畫面 (Output 1)
    renderOutput1(equations, excitation, ffType);
    
    // 5. 動態解析方程式並畫出電路圖 (Output 2)
    drawDynamicCircuit(equations, ffType, modelType);
}

// 讀取 UI 輸入，轉化為 8 個 Minterm 的陣列 (0~7)
// 陣列索引定義: bit2=Q1, bit1=Q0, bit0=X
function readTruthTable() {
    let tt = Array(8).fill(null); 
    // 狀態 11 (Minterm 6, 7) 在 A,B,C 系統中不存在，設為 Don't Care ('X')
    tt[6] = { nq1: 'X', nq0: 'X', z: 'X' };
    tt[7] = { nq1: 'X', nq0: 'X', z: 'X' };

    for(let i=0; i<6; i++) {
        const pres = fixedInputs[i].present;
        const x = parseInt(fixedInputs[i].x);
        const next = document.getElementById(`next_${i}`).value;
        const z = document.getElementById(`z_${i}`).value;
        
        const q = stateCode[pres];
        const nq = stateCode[next];
        const index = (q[0] << 2) | (q[1] << 1) | x;
        
        tt[index] = { q1: q[0], q0: q[1], x: x, nq1: nq[0], nq0: nq[1], z: parseInt(z) };
    }
    return tt;
}

// 產生正反器激勵表 (Excitation Table)
function calculateExcitation(tt, ffType) {
    let ex = { J1: [], K1: [], J0: [], K0: [], D1: [], D0: [], Z: [] };
    
    for(let i=0; i<8; i++) {
        let row = tt[i];
        if (row.nq1 === 'X') { // Don't Care
            ['J1','K1','J0','K0','D1','D0','Z'].forEach(k => ex[k].push('X'));
            continue;
        }
        ex.Z.push(row.z);
        
        if (ffType === 'd') {
            ex.D1.push(row.nq1);
            ex.D0.push(row.nq0);
        } else {
            // JK 轉換邏輯
            ex.J1.push(row.q1 === 0 ? row.nq1 : 'X');
            ex.K1.push(row.q1 === 1 ? (1 - row.nq1) : 'X');
            ex.J0.push(row.q0 === 0 ? row.nq0 : 'X');
            ex.K0.push(row.q0 === 1 ? (1 - row.nq0) : 'X');
        }
    }
    return ex;
}

// 貪婪演算法布林化簡器 (3 變數專用)
function minimizeLogic(ex, ffType) {
    // 預先定義所有可能的 Prime Implicants (Q1, Q0, X)
    const implicants = [
        { term: "1", mask: 0b000, val: 0b000, size: 8 }, // 全包
        { term: "Q1", mask: 0b100, val: 0b100, size: 4 }, { term: "Q1'", mask: 0b100, val: 0b000, size: 4 },
        { term: "Q0", mask: 0b010, val: 0b010, size: 4 }, { term: "Q0'", mask: 0b010, val: 0b000, size: 4 },
        { term: "X",  mask: 0b001, val: 0b001, size: 4 }, { term: "X'",  mask: 0b001, val: 0b000, size: 4 },
        { term: "Q1·Q0", mask: 0b110, val: 0b110, size: 2 }, { term: "Q1·Q0'", mask: 0b110, val: 0b100, size: 2 },
        { term: "Q1'·Q0", mask: 0b110, val: 0b010, size: 2 }, { term: "Q1'·Q0'", mask: 0b110, val: 0b000, size: 2 },
        { term: "Q1·X", mask: 0b101, val: 0b101, size: 2 }, { term: "Q1·X'", mask: 0b101, val: 0b100, size: 2 },
        { term: "Q1'·X", mask: 0b101, val: 0b001, size: 2 }, { term: "Q1'·X'", mask: 0b101, val: 0b000, size: 2 },
        { term: "Q0·X", mask: 0b011, val: 0b011, size: 2 }, { term: "Q0·X'", mask: 0b011, val: 0b010, size: 2 },
        { term: "Q0'·X", mask: 0b011, val: 0b001, size: 2 }, { term: "Q0'·X'", mask: 0b011, val: 0b000, size: 2 },
        { term: "Q1·Q0·X", mask: 0b111, val: 0b111, size: 1 }, { term: "Q1'·Q0'·X'", mask: 0b111, val: 0b000, size: 1 } // 略過部分 size 1，通常不會用到那麼細
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
        
        // 貪婪挑選能覆蓋最多剩餘 1 的 Implicant
        while(covered.size < ones.length) {
            let bestImp = null, bestCover = [];
            for (let imp of implicants) {
                let currentCover = [];
                let valid = true;
                for (let i=0; i<8; i++) {
                    if ((i & imp.mask) === imp.val) {
                        if (truthArr[i] == 0) { valid = false; break; } // 碰到 0 則此圈不合法
                        if (truthArr[i] == 1 && !covered.has(i)) currentCover.push(i);
                    }
                }
                if (valid && currentCover.length > (bestCover ? bestCover.length : 0)) {
                    bestImp = imp; bestCover = currentCover;
                }
            }
            if (!bestImp) break; // 防呆
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

// 輸出畫面 1 (方程式與卡諾圖)
function renderOutput1(eq, ex, ffType) {
    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = '';
    
    let keys = ffType === 'jk' ? ['J1','K1','J0','K0'] : ['D1','D0'];
    let firstKey = keys[0];

    keys.forEach(k => {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>FF for ${k.charAt(1)}</td><td style="font-weight:bold;">${k}</td><td style="color:#2563eb; font-weight:bold;">${k} = ${eq[k]}</td>`;
        tbody.appendChild(tr);
    });

    // 繪製第一個方程式的卡諾圖示意
    const arr = ex[firstKey];
    const kmapHTML = `
        <div style="font-size:0.85rem; text-align:center;">
            <p style="margin-bottom:8px; font-weight:600; color:#475569;">K-Map for ${firstKey}</p>
            <table style="width:80%; margin:auto; background: #ffffff;">
                <tr><th>Q1 \\ X Q0</th><th>00</th><th>01</th><th>11</th><th>10</th></tr>
                <tr><th>0</th><td>${arr[0]}</td><td>${arr[1]}</td><td>${arr[3]}</td><td>${arr[2]}</td></tr>
                <tr><th>1</th><td>${arr[4]}</td><td>${arr[5]}</td><td>${arr[7]}</td><td>${arr[6]}</td></tr>
            </table>
            <p style="margin-top:6px; color:#16a34a; font-weight:bold;">${firstKey} = ${eq[firstKey]}</p>
        </div>
    `;
    document.getElementById('kmap-container').innerHTML = kmapHTML;
}

// ========================================================
// 動態解析與繪圖引擎 (Output 2)
// ========================================================
function drawDynamicCircuit(eq, ffType, modelType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px Courier New';

    // 基礎骨架：X 與 CLK 線
    ctx.fillText("X", 10, 35); ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(600, 30); ctx.stroke();
    ctx.fillText("CLK", 5, 385); ctx.beginPath(); ctx.moveTo(35, 380); ctx.lineTo(550, 380); ctx.stroke();

    const q1X = 260, q1Y = 160;
    const q0X = 460, q0Y = 160;

    // 畫出正反器
    if(ffType === 'jk') {
        drawJKFlipFlop(ctx, q1X, q1Y, "Q1"); drawJKFlipFlop(ctx, q0X, q0Y, "Q0");
        // 動態繪製輸入端線路
        drawPinLogic(ctx, eq.J1, 160, 175, q1X, 185);
        drawPinLogic(ctx, eq.K1, 160, 235, q1X, 245);
        drawPinLogic(ctx, eq.J0, 360, 175, q0X, 185);
        drawPinLogic(ctx, eq.K0, 360, 235, q0X, 245);
    } else {
        drawDFlipFlop(ctx, q1X, q1Y, "Q1"); drawDFlipFlop(ctx, q0X, q0Y, "Q0");
        drawPinLogic(ctx, eq.D1, 160, 205, q1X, 215);
        drawPinLogic(ctx, eq.D0, 360, 205, q0X, 215);
    }

    // CLK 接線
    ctx.beginPath(); ctx.moveTo(290, 380); ctx.lineTo(290, 260); ctx.stroke(); drawDot(ctx, 290, 380);
    ctx.beginPath(); ctx.moveTo(490, 380); ctx.lineTo(490, 260); ctx.stroke(); drawDot(ctx, 490, 380);
}

// 解析布林字串並動態畫出對應的邏輯閘 (AND, OR) 與接線
function drawPinLogic(ctx, equation, startX, startY, pinX, pinY) {
    ctx.beginPath();
    
    if (equation === "0" || equation === "1") {
        // 直接接 VCC 或 GND (文字標示)
        ctx.moveTo(pinX - 30, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
        ctx.fillText(equation === "1" ? "VCC" : "GND", pinX - 55, pinY + 4);
    } 
    else if (equation.includes("+")) {
        // 包含加號，畫 OR 閘
        drawORGate(ctx, startX, startY - 10, "OR");
        ctx.moveTo(startX + 35, startY + 5); ctx.lineTo(pinX, pinY); ctx.stroke();
        ctx.fillStyle = '#2563eb'; ctx.fillText(equation, startX - 80, startY + 5); ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.moveTo(startX - 20, startY - 5); ctx.lineTo(startX, startY - 5); ctx.stroke(); // Input 1
        ctx.beginPath(); ctx.moveTo(startX - 20, startY + 15); ctx.lineTo(startX, startY + 15); ctx.stroke(); // Input 2
    } 
    else if (equation.includes("·")) {
        // 包含乘號，畫 AND 閘
        drawANDGate(ctx, startX, startY - 10, "AND");
        ctx.moveTo(startX + 35, startY + 5); ctx.lineTo(pinX, pinY); ctx.stroke();
        ctx.fillStyle = '#2563eb'; ctx.fillText(equation, startX - 80, startY + 5); ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.moveTo(startX - 20, startY - 5); ctx.lineTo(startX, startY - 5); ctx.stroke(); // Input 1
        ctx.beginPath(); ctx.moveTo(startX - 20, startY + 15); ctx.lineTo(startX, startY + 15); ctx.stroke(); // Input 2
    } 
    else {
        // 單一變數直連
        ctx.moveTo(startX, pinY); ctx.lineTo(pinX, pinY); ctx.stroke();
        ctx.fillStyle = '#2563eb'; ctx.fillText(equation, startX - 30, pinY - 5); ctx.fillStyle = '#0f172a';
    }
}

function drawDot(ctx, x, y) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }

function drawJKFlipFlop(ctx, x, y, label) {
    ctx.strokeRect(x, y, 60, 100);
    ctx.fillText("J", x + 5, y + 30); ctx.fillText("K", x + 5, y + 90);
    ctx.fillText("Q", x + 45, y + 30); ctx.fillText("Q'", x + 40, y + 90);
    ctx.fillText(label, x + 20, y - 8);
    ctx.beginPath(); ctx.moveTo(x, y + 45); ctx.lineTo(x + 10, y + 50); ctx.lineTo(x, y + 55); ctx.stroke();
}

function drawDFlipFlop(ctx, x, y, label) {
    ctx.strokeRect(x, y, 60, 100);
    ctx.fillText("D", x + 5, y + 55);
    ctx.fillText("Q", x + 45, y + 30); ctx.fillText("Q'", x + 40, y + 90);
    ctx.fillText(label, x + 20, y - 8);
    ctx.beginPath(); ctx.moveTo(x, y + 45); ctx.lineTo(x + 10, y + 50); ctx.lineTo(x, y + 55); ctx.stroke();
}

function drawORGate(ctx, x, y, txt) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x+15, y, x+35, y+15);
    ctx.quadraticCurveTo(x+15, y+30, x, y+30); ctx.quadraticCurveTo(x+10, y+15, x, y); ctx.stroke();
    if(txt) ctx.fillText(txt, x+10, y+19);
}

function drawANDGate(ctx, x, y, txt) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+20, y);
    ctx.arc(x+20, y+15, 15, -Math.PI/2, Math.PI/2); ctx.lineTo(x, y+30); ctx.closePath(); ctx.stroke();
    if(txt) ctx.fillText(txt, x+5, y+19);
}

function downloadPNG() {
    const link = document.createElement('a'); link.download = 'Sequential_Circuit_Diagram.png';
    link.href = document.getElementById('circuitCanvas').toDataURL("image/png"); link.click();
}
function exportPDF() {
    html2pdf().set({ margin: 8, filename: '期末專題報告.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(document.body).save();
}
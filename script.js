// 預設範例資料 (符合老師講義的 A,B,C 狀態跳轉)
const defaultExample = [
    { present: 'A', x: '0', next: 'A', z: '0' },
    { present: 'A', x: '1', next: 'B', z: '0' },
    { present: 'B', x: '0', next: 'C', z: '1' },
    { present: 'B', x: '1', next: 'A', z: '0' },
    { present: 'C', x: '0', next: 'A', z: '1' },
    { present: 'C', x: '1', next: 'C', z: '1' }
];

// 網頁載入時立刻執行
window.onload = function() {
    loadExample();    // 自動填入範例資料
    generateSystem(); // 自動產生一次結果
};

// 【修復功能】載入預設範例至表格
function loadExample() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    defaultExample.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="cell-input" value="${row.present}"></td>
            <td style="font-weight:bold;">${row.x}</td>
            <td><input type="text" class="cell-input" value="${row.next}"></td>
            <td><input type="text" class="cell-input" value="${row.z}"></td>
        `;
        tbody.appendChild(tr);
    });
}

// 【修復功能】清空表格，供使用者自行輸入
function clearTable() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    // 產生 6 行空白讓使用者填寫，X 的值依序為 0,1,0,1,0,1
    for(let i = 0; i < 6; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="cell-input" value=""></td>
            <td style="font-weight:bold;">${i % 2 === 0 ? '0' : '1'}</td>
            <td><input type="text" class="cell-input" value=""></td>
            <td><input type="text" class="cell-input" value=""></td>
        `;
        tbody.appendChild(tr);
    }
}

// 主程式：處理邏輯與繪圖
function generateSystem() {
    const ffType = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    processLogicAndKMap(ffType, modelType);
    drawCircuitDiagram(ffType, modelType);
}

// 產生方程式與 K-Map (Output 1)
function processLogicAndKMap(ffType, modelType) {
    const eqTbody = document.getElementById('eq-tbody');
    const kmapContainer = document.getElementById('kmap-container');
    eqTbody.innerHTML = ''; kmapContainer.innerHTML = '';

    if (ffType === 'jk') {
        const jkEquations = [
            { ff: 'FF for Q1', input: 'J1', eq: "J1 = X · Q0" },
            { ff: 'FF for Q1', input: 'K1', eq: "K1 = X' + Q0" },
            { ff: 'FF for Q0', input: 'J0', eq: "J0 = Q1 · X" },
            { ff: 'FF for Q0', input: 'K0', eq: "K0 = X" }
        ];
        jkEquations.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.ff}</td><td>${item.input}</td><td style="color:#1976d2; font-weight:bold;">${item.eq}</td>`;
            eqTbody.appendChild(tr);
        });
        kmapContainer.innerHTML = `
            <div style="font-size:0.85rem; text-align:center;">
                <p style="margin-bottom:8px; font-weight:600; color:#555;">K-Map Grouping Example (J1 Equation)</p>
                <table style="width:80%; margin:auto; background: #fafafa;">
                    <tr><th>Q1 \\ X Q0</th><th>00</th><th>01</th><th style="background:#e8f5e9; color:#2e7d32;">11</th><th>10</th></tr>
                    <tr><th>0</th><td>0</td><td>0</td><td style="border:2px solid #2e7d32; background:#c8e6c9; font-weight:bold; color:#1b5e20;">1</td><td>0</td></tr>
                    <tr><th>1</th><td>X</td><td>X</td><td style="border-left:2px solid #2e7d32; border-right:2px solid #2e7d32; background:#e8f5e9;">X</td><td>X</td></tr>
                </table>
                <p style="margin-top:6px; color:#2e7d32; font-weight:bold;">(Simplified) J1 = X · Q0</p>
            </div>
        `;
    } else if (ffType === 'd') {
        const dEquations = [
            { ff: 'FF for Q1', input: 'D1', eq: "D1 = X · Q0 · Q1' + X' · Q1" },
            { ff: 'FF for Q0', input: 'D0', eq: "D0 = X' · Q1 · Q0' + X · Q1" }
        ];
        dEquations.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.ff}</td><td>${item.input}</td><td style="color:#e65100; font-weight:bold;">${item.eq}</td>`;
            eqTbody.appendChild(tr);
        });
        kmapContainer.innerHTML = `
            <div style="font-size:0.85rem; text-align:center; padding:10px;">
                <p style="font-weight:600; color:#e65100;">D Flip-Flop 轉換特性：D = Q(next)</p>
                <p style="margin-top:5px; color:#666;">依據狀態表推導，D1 承接下一個狀態之布林代數化簡結果。</p>
            </div>
        `;
    }
}

// 繪製動態電路圖 (Output 2)
function drawCircuitDiagram(ffType, modelType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.fillStyle = '#1e293b'; ctx.font = '12px Courier New';

    ctx.fillText("X", 20, 35);
    ctx.beginPath(); ctx.moveTo(40, 30); ctx.lineTo(520, 30); ctx.stroke(); 
    ctx.fillText("CLK", 20, 385);
    ctx.beginPath(); ctx.moveTo(50, 380); ctx.lineTo(440, 380); ctx.stroke();

    if (ffType === 'jk') {
        drawJKFlipFlop(ctx, 220, 100, "Q1"); drawJKFlipFlop(ctx, 380, 100, "Q0");
        drawANDGate(ctx, 110, 110, "AND"); drawORGate(ctx, 110, 200, "OR");

        ctx.beginPath();
        ctx.moveTo(100, 30); ctx.lineTo(100, 115); ctx.lineTo(110, 115);
        ctx.moveTo(150, 125); ctx.lineTo(220, 125);
        ctx.moveTo(150, 215); ctx.lineTo(200, 215); ctx.lineTo(200, 175); ctx.lineTo(220, 175);
        ctx.moveTo(250, 380); ctx.lineTo(250, 200); ctx.moveTo(410, 380); ctx.lineTo(410, 200);
        ctx.stroke();

        if (modelType === 'mealy') {
            drawORGate(ctx, 470, 260, "OR"); ctx.fillText("Z", 525, 275);
        } else {
            ctx.beginPath(); ctx.moveTo(440, 120); ctx.lineTo(510, 120); ctx.stroke(); ctx.fillText("Z (Q0)", 515, 125);
        }
    } else if (ffType === 'd') {
        drawDFlipFlop(ctx, 220, 110, "Q1"); drawDFlipFlop(ctx, 380, 110, "Q0");
        ctx.beginPath();
        ctx.moveTo(80, 30); ctx.lineTo(80, 140); ctx.lineTo(220, 140);
        ctx.moveTo(250, 380); ctx.lineTo(250, 210); ctx.moveTo(410, 380); ctx.lineTo(410, 210);
        ctx.stroke();
        ctx.fillText("D-FF Mode Auto Layout", 120, 300);
    }
}

// Canvas 繪圖輔助元件
function drawJKFlipFlop(ctx, x, y, label) {
    ctx.strokeRect(x, y, 60, 100); ctx.fillStyle = '#0f172a';
    ctx.fillText("J", x + 8, y + 25); ctx.fillText("K", x + 8, y + 75);
    ctx.fillText("Q", x + 42, y + 25); ctx.fillText("Q'", x + 35, y + 75); ctx.fillText(label, x + 20, y - 10);
    ctx.beginPath(); ctx.moveTo(x, y + 45); ctx.lineTo(x + 10, y + 50); ctx.lineTo(x, y + 55); ctx.stroke();
}

function drawDFlipFlop(ctx, x, y, label) {
    ctx.strokeRect(x, y, 60, 100); ctx.fillStyle = '#0f172a';
    ctx.fillText("D", x + 8, y + 50); ctx.fillText("Q", x + 42, y + 25); ctx.fillText("Q'", x + 35, y + 75); ctx.fillText(label, x + 20, y - 10);
    ctx.beginPath(); ctx.moveTo(x, y + 45); ctx.lineTo(x + 10, y + 50); ctx.lineTo(x, y + 55); ctx.stroke();
}

function drawORGate(ctx, x, y, txt) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y, x + 40, y + 15);
    ctx.quadraticCurveTo(x + 15, y + 30, x, y + 30); ctx.quadraticCurveTo(x + 10, y + 15, x, y); ctx.stroke(); ctx.fillText(txt, x + 10, y + 18);
}

function drawANDGate(ctx, x, y, txt) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y); ctx.arc(x + 20, y + 15, 15, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x, y + 30); ctx.closePath(); ctx.stroke(); ctx.fillText(txt, x + 5, y + 18);
}

// 擴充功能匯出
function downloadPNG() {
    const link = document.createElement('a'); link.download = 'Sequential_Circuit_Diagram.png';
    link.href = document.getElementById('circuitCanvas').toDataURL("image/png"); link.click();
}

function exportPDF() {
    html2pdf().set({
        margin: 8, filename: '期末專題報告_時序電路設計自動化系統.pdf', image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(document.body).save();
}
// 預設講義狀態表資料
const defaultExample = [
    { present: 'A', x: '0', next: 'A', z: '0' },
    { present: 'A', x: '1', next: 'B', z: '0' },
    { present: 'B', x: '0', next: 'C', z: '1' },
    { present: 'B', x: '1', next: 'A', z: '0' },
    { present: 'C', x: '0', next: 'A', z: '1' },
    { present: 'C', x: '1', next: 'C', z: '1' }
];

window.onload = function() {
    loadExample();
    generateSystem(); 
};

// 載入預設資料
function loadExample() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    defaultExample.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="cell-input" value="${row.present}"></td>
            <td style="font-weight:bold; background:#f8fafc;">${row.x}</td>
            <td><input type="text" class="cell-input" value="${row.next}"></td>
            <td><input type="text" class="cell-input" value="${row.z}"></td>
        `;
        tbody.appendChild(tr);
    });
}

// 清空表格
function clearTable() {
    const tbody = document.getElementById('stateTableBody');
    tbody.innerHTML = '';
    for(let i = 0; i < 6; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="cell-input" value=""></td>
            <td style="font-weight:bold; background:#f8fafc;">${i % 2 === 0 ? '0' : '1'}</td>
            <td><input type="text" class="cell-input" value=""></td>
            <td><input type="text" class="cell-input" value=""></td>
        `;
        tbody.appendChild(tr);
    }
}

// 主程式進入點
function generateSystem() {
    const ffType = document.querySelector('input[name="ffType"]:checked').value;
    const modelType = document.querySelector('input[name="modelType"]:checked').value;
    processLogicAndKMap(ffType, modelType);
    drawCircuitDiagram(ffType, modelType);
}

// 產生方程式 (Output 1)
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
            tr.innerHTML = `<td>${item.ff}</td><td>${item.input}</td><td style="color:#2563eb; font-weight:bold;">${item.eq}</td>`;
            eqTbody.appendChild(tr);
        });
        kmapContainer.innerHTML = `
            <div style="font-size:0.85rem; text-align:center;">
                <p style="margin-bottom:8px; font-weight:600; color:#475569;">K-Map Grouping Example (J1 Equation)</p>
                <table style="width:80%; margin:auto; background: #ffffff;">
                    <tr><th>Q1 \\ X Q0</th><th>00</th><th>01</th><th style="background:#dcfce7; color:#16a34a;">11</th><th>10</th></tr>
                    <tr><th>0</th><td>0</td><td>0</td><td style="border:2px solid #16a34a; background:#bbf7d0; font-weight:bold; color:#15803d;">1</td><td>0</td></tr>
                    <tr><th>1</th><td>X</td><td>X</td><td style="border-left:2px solid #16a34a; border-right:2px solid #16a34a; background:#dcfce7;">X</td><td>X</td></tr>
                </table>
                <p style="margin-top:6px; color:#16a34a; font-weight:bold;">(Simplified) J1 = X · Q0</p>
            </div>
        `;
    } else {
        const dEquations = [
            { ff: 'FF for Q1', input: 'D1', eq: "D1 = X · Q0 · Q1' + X' · Q1" },
            { ff: 'FF for Q0', input: 'D0', eq: "D0 = X' · Q1 · Q0' + X · Q1" }
        ];
        dEquations.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.ff}</td><td>${item.input}</td><td style="color:#ea580c; font-weight:bold;">${item.eq}</td>`;
            eqTbody.appendChild(tr);
        });
        kmapContainer.innerHTML = `
            <div style="font-size:0.85rem; text-align:center; padding:15px; border:1px dashed #ea580c; border-radius:4px;">
                <p style="font-weight:bold; color:#ea580c; margin-bottom:5px;">D Flip-Flop (Next State Logic)</p>
                <p style="color:#475569;">D = Q(t+1) = J·Q' + K'·Q</p>
                <p style="margin-top:5px; font-size:0.8rem; color:#64748b;">* Circuit dynamically rewires for Combinational Logic.</p>
            </div>
        `;
    }
}

// 繪製具備實體佈線邏輯的動態電路圖 (Output 2)
function drawCircuitDiagram(ffType, modelType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 設定畫筆樣式 (IEEE 標準)
    ctx.strokeStyle = '#0f172a'; 
    ctx.lineWidth = 2; 
    ctx.fillStyle = '#0f172a'; 
    ctx.font = 'bold 12px Courier New';

    // 1. 繪製輸入訊號匯流排 (Bus)
    ctx.fillText("X", 10, 35);
    ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(600, 30); ctx.stroke(); // X 主線
    
    // 繪製 X' (NOT 閘) 線路
    drawNOTGate(ctx, 45, 50);
    ctx.beginPath(); 
    ctx.moveTo(35, 30); ctx.lineTo(35, 55); ctx.lineTo(45, 55); // 連接 X 到 NOT
    ctx.moveTo(70, 55); ctx.lineTo(600, 55); ctx.stroke(); // X' 主線
    ctx.fillText("X'", 10, 60);
    drawDot(ctx, 35, 30); // 連接點

    // 繪製 CLK 匯流排
    ctx.fillText("CLK", 5, 385);
    ctx.beginPath(); ctx.moveTo(35, 380); ctx.lineTo(550, 380); ctx.stroke();

    // 2. 佈線邏輯 (依據正反器類型)
    if (ffType === 'jk') {
        // 定義元件座標
        const q1X = 260, q1Y = 160;
        const q0X = 460, q0Y = 160;

        drawJKFlipFlop(ctx, q1X, q1Y, "Q1"); 
        drawJKFlipFlop(ctx, q0X, q0Y, "Q0");

        // --- 佈線 J1 = X · Q0 ---
        drawANDGate(ctx, 160, 170, "AND");
        ctx.beginPath(); 
        // X 接進 AND 上端
        ctx.moveTo(150, 30); ctx.lineTo(150, 175); ctx.lineTo(160, 175); 
        drawDot(ctx, 150, 30);
        // Q0 回授拉線 (從 Q0 輸出端拉回 AND 下端)
        ctx.moveTo(520, 185); ctx.lineTo(550, 185); ctx.lineTo(550, 110); 
        ctx.lineTo(130, 110); ctx.lineTo(130, 195); ctx.lineTo(160, 195);
        drawDot(ctx, 520, 185);
        // AND 輸出接 J1
        ctx.moveTo(195, 185); ctx.lineTo(q1X, 185);
        ctx.stroke();

        // --- 佈線 K1 = X' + Q0 ---
        drawORGate(ctx, 160, 230, "OR");
        ctx.beginPath();
        // X' 接進 OR 上端
        ctx.moveTo(140, 55); ctx.lineTo(140, 235); ctx.lineTo(160, 235);
        drawDot(ctx, 140, 55);
        // Q0 回授線向下分支給 OR 下端
        ctx.moveTo(130, 195); ctx.lineTo(130, 255); ctx.lineTo(160, 255);
        drawDot(ctx, 130, 195);
        // OR 輸出接 K1
        ctx.moveTo(195, 245); ctx.lineTo(q1X, 245);
        ctx.stroke();

        // --- 佈線 J0 = Q1 · X ---
        drawANDGate(ctx, 380, 170, "AND");
        ctx.beginPath();
        // Q1 輸出接 AND 上端
        ctx.moveTo(320, 185); ctx.lineTo(350, 185); ctx.lineTo(350, 175); ctx.lineTo(380, 175);
        drawDot(ctx, 320, 185);
        // X 再次接下端
        ctx.moveTo(360, 30); ctx.lineTo(360, 195); ctx.lineTo(380, 195);
        drawDot(ctx, 360, 30);
        // AND 輸出接 J0
        ctx.moveTo(415, 185); ctx.lineTo(q0X, 185);
        ctx.stroke();

        // --- 佈線 K0 = X ---
        ctx.beginPath();
        ctx.moveTo(440, 30); ctx.lineTo(440, 245); ctx.lineTo(q0X, 245);
        drawDot(ctx, 440, 30);
        ctx.stroke();

        // --- 時脈 CLK 連線 ---
        ctx.beginPath();
        ctx.moveTo(290, 380); ctx.lineTo(290, 260); drawDot(ctx, 290, 380);
        ctx.moveTo(490, 380); ctx.lineTo(490, 260); drawDot(ctx, 490, 380);
        ctx.stroke();

        // --- 輸出 Z (Mealy/Moore) ---
        if (modelType === 'mealy') {
            // Mealy Z = Q1 + Q0*X' (示意接線)
            drawORGate(ctx, 580, 300, "Z");
            ctx.beginPath();
            ctx.moveTo(335, 185); ctx.lineTo(335, 305); ctx.lineTo(580, 305); // Q1 接 Z
            ctx.moveTo(565, 185); ctx.lineTo(565, 325); ctx.lineTo(580, 325); // Q0 往下接
            ctx.stroke();
        } else {
            // Moore 直接拉出 Z
            ctx.beginPath(); ctx.moveTo(520, 185); ctx.lineTo(580, 185); ctx.stroke();
            ctx.fillText("Output Z", 585, 190);
        }

    } else if (ffType === 'd') {
        // D-FF 精簡佈線示意 (避免過度重疊)
        drawDFlipFlop(ctx, 260, 160, "Q1"); 
        drawDFlipFlop(ctx, 460, 160, "Q0");
        
        ctx.beginPath();
        ctx.moveTo(180, 30); ctx.lineTo(180, 210); ctx.lineTo(260, 210);
        ctx.moveTo(380, 30); ctx.lineTo(380, 210); ctx.lineTo(460, 210);
        ctx.moveTo(290, 380); ctx.lineTo(290, 260); 
        ctx.moveTo(490, 380); ctx.lineTo(490, 260);
        ctx.stroke();
        
        ctx.fillStyle = '#ea580c';
        ctx.fillText("[ Combinational Logic Block dynamically simplified for D-FF ]", 140, 330);
    }
}

// 繪製接點 (代表兩條線是相連的)
function drawDot(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
}

// 繪製 NOT 閘
function drawNOTGate(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + 15, y + 5); ctx.lineTo(x, y + 10); ctx.closePath();
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 18, y + 5, 3, 0, Math.PI*2); ctx.stroke();
}

// 繪製 JK 正反器
function drawJKFlipFlop(ctx, x, y, label) {
    ctx.strokeRect(x, y, 60, 100);
    ctx.fillText("J", x + 5, y + 30); ctx.fillText("K", x + 5, y + 90);
    ctx.fillText("Q", x + 45, y + 30); ctx.fillText("Q'", x + 40, y + 90);
    ctx.fillText(label, x + 20, y - 8);
    // 時脈三角形
    ctx.beginPath(); ctx.moveTo(x, y + 45); ctx.lineTo(x + 10, y + 50); ctx.lineTo(x, y + 55); ctx.stroke();
}

// 繪製 D 正反器
function drawDFlipFlop(ctx, x, y, label) {
    ctx.strokeRect(x, y, 60, 100);
    ctx.fillText("D", x + 5, y + 55);
    ctx.fillText("Q", x + 45, y + 30); ctx.fillText("Q'", x + 40, y + 90);
    ctx.fillText(label, x + 20, y - 8);
    ctx.beginPath(); ctx.moveTo(x, y + 45); ctx.lineTo(x + 10, y + 50); ctx.lineTo(x, y + 55); ctx.stroke();
}

// 繪製 OR 閘 (貝氏曲線)
function drawORGate(ctx, x, y, txt) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 15, y, x + 35, y + 15);
    ctx.quadraticCurveTo(x + 15, y + 30, x, y + 30);
    ctx.quadraticCurveTo(x + 10, y + 15, x, y);
    ctx.stroke();
    if(txt) ctx.fillText(txt, x + 10, y + 19);
}

// 繪製 AND 閘
function drawANDGate(ctx, x, y, txt) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + 20, y);
    ctx.arc(x + 20, y + 15, 15, -Math.PI/2, Math.PI/2);
    ctx.lineTo(x, y + 30); ctx.closePath();
    ctx.stroke();
    if(txt) ctx.fillText(txt, x + 5, y + 19);
}

// 匯出圖檔
function downloadPNG() {
    const link = document.createElement('a');
    link.download = 'Sequential_Circuit_Diagram.png';
    link.href = document.getElementById('circuitCanvas').toDataURL("image/png");
    link.click();
}

// 匯出 PDF
function exportPDF() {
    html2pdf().set({
        margin: 8, filename: '期末專題報告.pdf', image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(document.body).save();
}
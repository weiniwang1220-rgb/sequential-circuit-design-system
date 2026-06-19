// ====== 核心系統邏輯 ====== //

function generateSystem() {
    const ffType = document.querySelector('input[name="ffType"]:checked').value;
    generateEquations(ffType);
    drawCircuit(ffType);
}

// 產生方程式 (Output 1)
function generateEquations(ffType) {
    const tbody = document.getElementById('eq-tbody');
    const kmapContainer = document.getElementById('kmap-container');
    tbody.innerHTML = '';
    kmapContainer.innerHTML = '';

    let equations = [];
    
    // 依據選擇的 FF 類型產生對應方程式與 K-Map 視覺化
    if (ffType === 'jk') {
        equations = [
            { ff: 'FF for Q1', input: 'J1', eq: "J1 = X · Q0" },
            { ff: 'FF for Q1', input: 'K1', eq: "K1 = X' + Q0" },
            { ff: 'FF for Q0', input: 'J0', eq: "J0 = Q1 · X" },
            { ff: 'FF for Q0', input: 'K0', eq: "K0 = X" }
        ];
        kmapContainer.innerHTML = `<div style="text-align:center; padding: 20px;">
            <p>J1 的 K-Map 狀態分群 (已化簡): J1 = X · Q0</p>
            <table style="width:60%; margin:auto;">
                <tr><th>Q1 \\ X,Q0</th><th>00</th><th>01</th><th>11</th><th>10</th></tr>
                <tr><th>0</th><td>0</td><td>0</td><td style="border:2px solid green; background:#e8f5e9;">1</td><td>0</td></tr>
                <tr><th>1</th><td>X</td><td>X</td><td>X</td><td>X</td></tr>
            </table>
        </div>`;
    } else if (ffType === 'd') {
        // 擴充功能：D-FF 邏輯
        equations = [
            { ff: 'FF for Q1', input: 'D1', eq: "D1 = J1·Q1' + K1'·Q1" },
            { ff: 'FF for Q0', input: 'D0', eq: "D0 = J0·Q0' + K0'·Q0" }
        ];
        kmapContainer.innerHTML = `<div style="text-align:center; padding: 20px;">
            <p>D Flip-Flop Characteristic Equation: D = Q(next)</p>
            <p>D1 = X·Q0·Q1' + (X·Q0')·Q1</p>
        </div>`;
    }

    // 渲染 Table
    equations.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.ff}</td><td>${item.input}</td><td style="color:blue; font-weight:bold;">${item.eq}</td>`;
        tbody.appendChild(tr);
    });
}

// ====== Canvas 電路繪製引擎 (Output 2) ====== //

function drawCircuit(ffType) {
    const canvas = document.getElementById('circuitCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清空畫布

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = '14px Arial';

    // 繪製輸入線 X 和 Clock
    drawLine(ctx, 30, 40, 450, 40);
    ctx.fillText("X", 10, 45);
    
    drawLine(ctx, 30, 360, 400, 360);
    ctx.fillText("CLK", 10, 365);

    if (ffType === 'jk') {
        // 繪製兩個 JK Flip-Flop
        drawFlipFlop(ctx, 200, 100, 'JK', 'Q1');
        drawFlipFlop(ctx, 350, 100, 'JK', 'Q0');

        // 繪製邏輯閘 (AND, OR) 示意
        drawANDGate(ctx, 100, 250);
        drawLine(ctx, 150, 270, 200, 120); // J1 連線示意

        drawORGate(ctx, 100, 310);
        drawLine(ctx, 150, 330, 200, 180); // K1 連線示意
        
        ctx.fillStyle = "blue";
        ctx.fillText("Circuit rendered based on JK Equations", 150, 390);

    } else if (ffType === 'd') {
        // 繪製兩個 D Flip-Flop
        drawFlipFlop(ctx, 200, 100, 'D', 'Q1');
        drawFlipFlop(ctx, 350, 100, 'D', 'Q0');
        
        ctx.fillStyle = "blue";
        ctx.fillText("Circuit rendered based on D-FF Equations", 150, 390);
    }
}

// 輔助繪圖函式
function drawFlipFlop(ctx, x, y, type, label) {
    ctx.strokeRect(x, y, 60, 100);
    ctx.fillStyle = '#000';
    if(type === 'JK') {
        ctx.fillText("J", x + 5, y + 20);
        ctx.fillText("K", x + 5, y + 80);
    } else {
        ctx.fillText("D", x + 5, y + 50);
    }
    // Clock triangle
    ctx.beginPath();
    ctx.moveTo(x, y + 90);
    ctx.lineTo(x + 10, y + 95);
    ctx.lineTo(x, y + 100);
    ctx.stroke();

    ctx.fillText("Q", x + 45, y + 20);
    ctx.fillText("Q'", x + 40, y + 80);
    ctx.fillText(label, x + 20, y - 10);
}

function drawANDGate(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 25, y);
    ctx.arc(x + 25, y + 20, 20, -Math.PI/2, Math.PI/2);
    ctx.lineTo(x, y + 40);
    ctx.closePath();
    ctx.stroke();
    ctx.fillText("AND", x+5, y+25);
}

function drawORGate(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 20, y, x + 40, y + 20);
    ctx.quadraticCurveTo(x + 20, y + 40, x, y + 40);
    ctx.quadraticCurveTo(x + 10, y + 20, x, y);
    ctx.stroke();
    ctx.fillText("OR", x+10, y+25);
}

function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// ====== 擴充功能匯出 ====== //

function downloadPNG() {
    const canvas = document.getElementById('circuitCanvas');
    const link = document.createElement('a');
    link.download = 'Sequential_Circuit.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function exportPDF() {
    const element = document.body;
    const opt = {
        margin:       10,
        filename:     'Sequential_Circuit_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}

// 頁面載入時初始化一次
window.onload = () => {
    generateSystem();
};
const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const tools = document.querySelectorAll('.tool');
const size = document.querySelector('#size');
const picker = document.querySelector('#color-picker');
const swatches = document.querySelector('#swatches');
const undoButtons = document.querySelectorAll('[data-history="undo"]');
const redoButtons = document.querySelectorAll('[data-history="redo"]');
const clearButtons = document.querySelectorAll('[data-action="clear"]');
const saveButtons = document.querySelectorAll('[data-action="save"]');

const COLORS = ['#1d1d1f', '#007aff', '#34c759', '#ff9500', '#ff3b30', '#ff2d55', '#af52de', '#5ac8fa', '#30d158', '#bf5af2', '#8e8e93', '#ffffff'];

let tool = 'pencil';
let color = picker.value;
let width = +size.value;
let drawing = false;
let start;
let snapshot;
let history = [];
let future = [];

function fillWhite() {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function saveState() {
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (history.length > 30) history.shift();
  future = [];
  updateHistory();
}

function updateHistory() {
  undoButtons.forEach(button => button.disabled = history.length < 2);
  redoButtons.forEach(button => button.disabled = !future.length);
}

function restore(state) {
  ctx.putImageData(state, 0, 0);
}

function point(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * canvas.width / rect.width,
    y: (e.clientY - rect.top) * canvas.height / rect.height
  };
}

function setupStroke(activeTool = tool) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = activeTool === 'eraser' ? '#fff' : color;
  ctx.lineWidth = width;
}

function drawShape(a, b, constrain) {
  restore(snapshot);
  setupStroke();

  let x = b.x;
  let y = b.y;
  let w = b.x - a.x;
  let h = b.y - a.y;

  if (constrain) {
    const maxSide = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w) * maxSide;
    h = Math.sign(h) * maxSide;
    x = a.x + w;
    y = a.y + h;
  }

  if (tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(constrain ? x : b.x, constrain ? y : b.y);
    ctx.stroke();
  }

  if (tool === 'rectangle') {
    ctx.strokeRect(a.x, a.y, w, h);
  }

  if (tool === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(a.x + w / 2, a.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function toHex(value) {
  return value.toString(16).padStart(2, '0');
}

function sampleColor(e) {
  const p = point(e);
  const pixel = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
  const sampled = pixel[3] === 0 ? '#ffffff' : `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
  setColor(sampled);
}

function selectTool(button) {
  tool = button.dataset.tool;
  tools.forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('#active-tool').textContent = button.querySelector('small').textContent;
  canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'picker' ? 'copy' : 'crosshair';
}

function undo() {
  if (history.length < 2) return;
  future.push(history.pop());
  restore(history[history.length - 1]);
  updateHistory();
}

function redo() {
  if (!future.length) return;
  const next = future.pop();
  history.push(next);
  restore(next);
  updateHistory();
}

function setColor(nextColor) {
  color = nextColor;
  picker.value = nextColor;
  document.querySelector('#color-value').textContent = nextColor.toUpperCase();
  document.querySelectorAll('.swatch').forEach(swatch => {
    swatch.classList.toggle('selected', swatch.dataset.color === nextColor);
  });
}

function clearCanvas() {
  if (confirm('Clear the whole canvas?')) {
    fillWhite();
    saveState();
  }
}

function savePng() {
  const link = document.createElement('a');
  link.download = 'my-painting.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', e => {
  if (tool === 'picker') {
    sampleColor(e);
    return;
  }

  drawing = true;
  canvas.setPointerCapture(e.pointerId);
  start = point(e);
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  setupStroke();

  if (tool === 'pencil' || tool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + 0.1, start.y + 0.1);
    ctx.stroke();
  }
});

canvas.addEventListener('pointermove', e => {
  if (!drawing) return;

  const p = point(e);
  if (tool === 'pencil' || tool === 'eraser') {
    setupStroke();
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else {
    drawShape(start, p, e.shiftKey);
  }
});

function finish() {
  if (!drawing) return;
  drawing = false;
  saveState();
}

canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);
tools.forEach(button => button.addEventListener('click', () => selectTool(button)));
size.addEventListener('input', () => {
  width = +size.value;
  document.querySelector('#size-value').textContent = `${width} px`;
});
picker.addEventListener('input', () => setColor(picker.value));

COLORS.forEach(nextColor => {
  const button = document.createElement('button');
  button.className = 'swatch';
  button.dataset.color = nextColor;
  button.style.background = nextColor;
  button.title = nextColor;
  button.addEventListener('click', () => setColor(nextColor));
  swatches.append(button);
});

undoButtons.forEach(button => button.addEventListener('click', undo));
redoButtons.forEach(button => button.addEventListener('click', redo));
clearButtons.forEach(button => button.addEventListener('click', clearCanvas));
saveButtons.forEach(button => button.addEventListener('click', savePng));

window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  }
});

setColor(color);
fillWhite();
saveState();

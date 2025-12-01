// Helper: Load image from file
const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = () => reject(URL.revokeObjectURL(url));
    img.src = url;
  });

// Helper: Create unique ID
const uniqueId = () => {
  const a = Math.random().toString(36).substring(2, 15);
  const b = Math.random().toString(36).substring(2, 15);
  return a + b;
};

// State
const state = {
  slots: {},
  uiRid: null,
  zoom: 100,
  panX: 0,
  panY: 0,
  meetMode: false,
  dragging: false,
  dragStart: { x: 0, y: 0 },
};

// DOM elements
const $ = (id) => document.getElementById(id);
const app = $('app');
const slot = $('slot');
const grid = $('grid');
const toggleBtn = $('toggle-mode');
const resetBtn = $('reset-view');
const zoomDisplay = $('zoom');
const panDisplay = $('pan');
const addButton = $('add-btn');

slot.removeAttribute('id');
slot.remove();

const resizeObserver = new ResizeObserver(() => renderAll());

// Render canvas
const renderCanvas = (item) => {
  const { canvas, img, wrapper } = item;

  if (!img) return;

  const dpr = devicePixelRatio;
  const rect = wrapper.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d', { alpha: true });
  const [cw, ch, iw, ih] = [
    canvas.width,
    canvas.height,
    img.naturalWidth,
    img.naturalHeight,
  ];

  ctx.webkitImageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);

  const fitScale = Math.min(cw / iw, ch / ih);
  const fitW = iw * fitScale;
  const fitH = ih * fitScale;
  const zoomScale = state.zoom / 100;
  const scaledW = fitW * zoomScale;
  const scaledH = fitH * zoomScale;
  const baseX = (cw - fitW) / 2;
  const baseY = (ch - fitH) / 2;
  const imgX = baseX + state.panX * dpr + (fitW - scaledW) / 2;
  const imgY = baseY + state.panY * dpr + (fitH - scaledH) / 2;

  const visX = Math.max(0, imgX);
  const visY = Math.max(0, imgY);
  const visW = Math.min(cw, imgX + scaledW) - visX;
  const visH = Math.min(ch, imgY + scaledH) - visY;

  if (visW <= 0 || visH <= 0) return;

  const srcX = ((visX - imgX) / scaledW) * iw;
  const srcY = ((visY - imgY) / scaledH) * ih;
  const srcW = (visW / scaledW) * iw;
  const srcH = (visH / scaledH) * ih;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, visX, visY, visW, visH);
};

// Render all
const renderAll = () => {
  if (state.uiRid) cancelAnimationFrame(state.uiRid);

  state.uiRid = requestAnimationFrame(() => {
    zoomDisplay.textContent = `${Math.round(state.zoom)}`;
    panDisplay.textContent = `${Math.round(state.panX)}, ${Math.round(state.panY)}`;
    toggleBtn.textContent = state.meetMode ? 'Meet Images (4:3)' : 'Fit Images';
    toggleBtn.classList.toggle('active', state.meetMode);
    app.style.setProperty('--aspect', state.meetMode ? '4/3' : 'auto');
    app.style.setProperty('--overflow', state.meetMode ? 'auto' : 'hidden');
    app.style.setProperty(
      '--grid-width',
      state.meetMode ? 'max-content' : '100%',
    );
    app.style.setProperty('--slot-width', state.meetMode ? '400px' : 'auto');
    app.style.setProperty(
      '--delete-display',
      Object.keys(state.slots).length > 2 ? 'block' : 'none',
    );
  });

  for (const id in state.slots) {
    const item = state.slots[id];
    if (item.rid) cancelAnimationFrame(item.rid);
    item.rid = requestAnimationFrame(() => renderCanvas(item));
  }
};

// Render grid
const addImage = () => {
  const id = uniqueId();
  const slotClone = slot.cloneNode(true);
  const wrapper = slotClone.querySelector('.canvas-wrapper');
  const canvas = slotClone.querySelector('canvas');
  const dropzone = slotClone.querySelector('.drop-zone');
  const deleteBtn = slotClone.querySelector('.delete-btn');
  const item = {
    id,
    rid: null,
    url: null,
    img: null,
    slot: slotClone,
    wrapper,
    canvas,
    dropzone,
    deleteBtn,
  };

  slotClone.dataset.id = id;
  wrapper.dataset.id = id;
  canvas.dataset.id = id;
  dropzone.dataset.id = id;
  deleteBtn.dataset.id = id;
  deleteBtn.onclick = () => removeImage(id);

  const { length } = Object.keys(state.slots);
  state.slots[id] = item;
  app.style.setProperty('--cols', `${length + 1}`);
  grid.append(slotClone, addButton);
  resizeObserver.observe(slotClone);
};

const removeImage = (id) => {
  const { length } = Object.keys(state.slots);
  if (length <= 2) return;

  const item = state.slots[id];
  if (!item) return;

  resizeObserver.unobserve(item.slot);

  if (item.url) URL.revokeObjectURL(item.url);
  delete state.slots[id];
  item.slot.remove();
  app.style.setProperty('--cols', `${length - 1}`);
};

// Event handlers
const handleWheel = (e, id) => {
  e.preventDefault();

  const item = state.slots[id];
  const img = item?.img;
  if (!item || !img) return;

  const canvas = item.canvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = devicePixelRatio;
  const mouseX = (e.clientX - rect.left) * dpr;
  const mouseY = (e.clientY - rect.top) * dpr;
  const [cw, ch, iw, ih] = [
    canvas.width,
    canvas.height,
    img.naturalWidth,
    img.naturalHeight,
  ];

  const fitScale = Math.min(cw / iw, ch / ih);
  const fitW = iw * fitScale;
  const fitH = ih * fitScale;
  const oldZoom = state.zoom / 100;
  const oldW = fitW * oldZoom;
  const oldH = fitH * oldZoom;
  const baseX = (cw - fitW) / 2;
  const baseY = (ch - fitH) / 2;
  const oldX = baseX + state.panX * dpr + (fitW - oldW) / 2;
  const oldY = baseY + state.panY * dpr + (fitH - oldH) / 2;

  const normX = (mouseX - oldX) / oldW;
  const normY = (mouseY - oldY) / oldH;

  const delta = state.zoom * 0.1 * (e.deltaY > 0 ? -1 : 1);
  state.zoom = Math.max(10, Math.min(10000, state.zoom + delta));

  const newZoom = state.zoom / 100;
  const newW = fitW * newZoom;
  const newH = fitH * newZoom;
  const newX = mouseX - normX * newW;
  const newY = mouseY - normY * newH;

  state.panX = (newX - baseX - (fitW - newW) / 2) / dpr;
  state.panY = (newY - baseY - (fitH - newH) / 2) / dpr;

  renderAll();
};

const handleDrop = async (item, file) => {
  if (item.url) URL.revokeObjectURL(item.url);

  try {
    const image = await loadImage(file);
    item.url = image.url;
    item.img = image.img;
    item.slot.classList.remove('empty');
    renderCanvas(item);
  } catch {
    alert('Failed to load image');
  }
};

// Event delegation
grid.addEventListener(
  'wheel',
  (e) => {
    if (e.shiftKey) return;
    const { id } = e.target.dataset;
    if (id) handleWheel(e, id);
  },
  { passive: false },
);

grid.addEventListener('mousedown', (e) => {
  const { id } = e.target.dataset;
  const item = state.slots[id];
  if (!item?.img || e.button !== 0) return;

  e.preventDefault();
  state.dragging = true;
  state.dragStart = { x: e.clientX, y: e.clientY };
});

document.addEventListener('mousemove', (e) => {
  if (!state.dragging) return;
  state.panX += e.clientX - state.dragStart.x;
  state.panY += e.clientY - state.dragStart.y;
  state.dragStart = { x: e.clientX, y: e.clientY };

  renderAll();
});

document.addEventListener('mouseup', () => (state.dragging = false));

grid.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.target.closest('.drop-zone, .canvas-wrapper')?.classList.add('dragover');
});

grid.addEventListener('dragleave', (e) => {
  e.target.closest('.dragover')?.classList.remove('dragover');
});

grid.addEventListener('drop', (e) => {
  const target = e.target.closest('.dragover');
  if (!target) return;

  e.preventDefault();

  target.classList.remove('dragover');
  const { id } = target.dataset;
  const item = state.slots[id];
  const file = e.dataTransfer.files[0];

  if (!file?.type.startsWith('image/')) return;

  handleDrop(item, file);
});

addButton.addEventListener('click', () => {
  addImage(null);
});

toggleBtn.addEventListener('click', () => {
  state.meetMode = !state.meetMode;
  renderAll();
});

resetBtn.addEventListener('click', () => {
  state.zoom = 100;
  state.panX = 0;
  state.panY = 0;
  renderAll();
});

// Initialize
addImage(null);
addImage(null);

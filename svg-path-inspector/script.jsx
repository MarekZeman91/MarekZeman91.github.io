const { useCallback, useEffect, useRef, useState } = window.React;

// Path command definitions with parameter info
const COMMANDS = {
  M: { name: 'MoveTo', params: ['x', 'y'], relative: 'm' },
  m: { name: 'moveTo', params: ['x', 'y'], relative: 'm', absolute: 'M' },
  L: { name: 'LineTo', params: ['x', 'y'], relative: 'l' },
  l: { name: 'lineTo', params: ['x', 'y'], absolute: 'L' },
  H: { name: 'HorizontalTo', params: ['x'], relative: 'h' },
  h: { name: 'horizontalTo', params: ['x'], absolute: 'H' },
  V: { name: 'VerticalTo', params: ['y'], relative: 'v' },
  v: { name: 'verticalTo', params: ['y'], absolute: 'V' },
  C: {
    name: 'CurveTo',
    params: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
    relative: 'c',
  },
  c: {
    name: 'curveTo',
    params: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
    absolute: 'C',
  },
  S: { name: 'SmoothCurve', params: ['x2', 'y2', 'x', 'y'], relative: 's' },
  s: { name: 'smoothCurve', params: ['x2', 'y2', 'x', 'y'], absolute: 'S' },
  Q: { name: 'QuadCurve', params: ['x1', 'y1', 'x', 'y'], relative: 'q' },
  q: { name: 'quadCurve', params: ['x1', 'y1', 'x', 'y'], absolute: 'Q' },
  T: { name: 'SmoothQuad', params: ['x', 'y'], relative: 't' },
  t: { name: 'smoothQuad', params: ['x', 'y'], absolute: 'T' },
  A: {
    name: 'Arc',
    params: ['rx', 'ry', 'rotation', 'largeArc', 'sweep', 'x', 'y'],
    relative: 'a',
  },
  a: {
    name: 'arc',
    params: ['rx', 'ry', 'rotation', 'largeArc', 'sweep', 'x', 'y'],
    absolute: 'A',
  },
  Z: { name: 'ClosePath', params: [], relative: 'z' },
  z: { name: 'closePath', params: [], absolute: 'Z' },
};

const CONVERTIBLE_COMMANDS = Object.keys(COMMANDS);
const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])((?:[^MmLlHhVvCcSsQqTtAaZz])*)/g;
const numberRegex = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

// Parse path d attribute into segments
function parsePath(d) {
  if (!d || typeof d !== 'string') return [];

  const segments = [];
  // Match command letter followed by numbers (handles minified paths like "M16.67 13h-12.17")
  let match;

  while ((match = commandRegex.exec(d)) !== null) {
    const command = match[1];
    const paramsStr = match[2].trim();

    // Parse numbers including negatives and decimals without spaces (e.g., "16.67-12.17" or ".5-.5")
    const values = [];
    let numMatch;

    while ((numMatch = numberRegex.exec(paramsStr)) !== null) {
      values.push(parseFloat(numMatch[0]));
    }

    segments.push({
      id: crypto.randomUUID(),
      command,
      values,
    });
  }

  return segments;
}

// Convert segments back to path string
function segmentsToPath(segments) {
  return segments
    .map((seg) => `${seg.command}${seg.values.join(' ')}`)
    .join(' ');
}

// Get command info helper
function getCommandInfo(command) {
  return COMMANDS[command] || { name: 'Unknown', params: [] };
}

// Check if command is absolute
function isAbsolute(command) {
  return command === command.toUpperCase();
}

// Toggle absolute/relative
function toggleCase(command) {
  return isAbsolute(command) ? command.toLowerCase() : command.toUpperCase();
}

const initState = {
  x: -10,
  y: -10,
  w: 1280,
  h: 800,
  zoom: 1,
  panStartX: 0,
  panStartY: 0,
  isPanning: false,
};

function usePreviewState() {
  const [state, setState] = useState(() => ({ ...initState }));
  const updateState = useCallback((changes) => {
    const newState = { ...state, ...changes };
    setState(() => newState);
    Object.assign(state, newState);
  }, []);

  return [state, updateState];
}

// Segment Row Component
function SegmentRow({
  segment,
  index,
  onUpdate,
  onDelete,
  onInsert,
  totalSegments,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const info = getCommandInfo(segment.command);
  const absolute = isAbsolute(segment.command);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleAbsolute = () => {
    onUpdate(index, { ...segment, command: toggleCase(segment.command) });
  };

  const handleValueChange = (paramIndex, value) => {
    const newValues = [...segment.values];
    newValues[paramIndex] = parseFloat(value) || 0;
    onUpdate(index, { ...segment, values: newValues });
  };

  const handleConvertTo = (newCommand) => {
    const newInfo = getCommandInfo(newCommand);
    const newValues = new Array(newInfo.params.length).fill(0);

    // Try to preserve compatible values
    info.params.forEach((param, i) => {
      const newIndex = newInfo.params.indexOf(param);
      if (newIndex !== -1 && i < segment.values.length) {
        newValues[newIndex] = segment.values[i];
      }
    });

    onUpdate(index, { ...segment, command: newCommand, values: newValues });
    setShowMenu(false);
  };

  const createNewSegment = (command) => ({
    id: crypto.randomUUID(),
    command,
    values: new Array(getCommandInfo(command).params.length).fill(0),
  });

  return (
    <div className="segment-row">
      <div className="segment-header">
        <span className="segment-index">{index}</span>
        <button
          className={`toggle-btn ${absolute ? 'is-absolute' : 'is-relative'}`}
          onClick={handleToggleAbsolute}
          title={
            absolute
              ? 'Absolute (click for relative)'
              : 'Relative (click for absolute)'
          }
        >
          {absolute ? 'ABS' : 'rel'}
        </button>
        <span className="segment-command">{segment.command}</span>
        <span className="segment-name">{info.name}</span>

        <div className="segment-actions" ref={menuRef}>
          <button className="action-btn" onClick={() => setShowMenu(!showMenu)}>
            ⋮
          </button>
          {showMenu && (
            <div className="action-menu">
              <button
                onClick={() => {
                  onInsert(index, createNewSegment('L'));
                  setShowMenu(false);
                }}
              >
                ↑ Insert Before
              </button>
              <button
                onClick={() => {
                  onInsert(index + 1, createNewSegment('L'));
                  setShowMenu(false);
                }}
              >
                ↓ Insert After
              </button>
              <div className="menu-divider" />
              <div className="convert-submenu">
                <span className="submenu-label">Convert to:</span>
                <div className="convert-options">
                  {CONVERTIBLE_COMMANDS.filter(
                    (c) => c !== segment.command,
                  ).map((cmd) => (
                    <button
                      key={cmd}
                      className="convert-btn"
                      onClick={() => handleConvertTo(cmd)}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu-divider" />
              <button
                className="delete-btn"
                onClick={() => {
                  onDelete(index);
                  setShowMenu(false);
                }}
                disabled={totalSegments <= 1}
              >
                🗑 Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="segment-params">
        {info.params.map((param, i) => (
          <label key={param} className="param-input">
            <span className="param-label">{param}</span>
            <input
              type="number"
              step={param === 'largeArc' || param === 'sweep' ? 1 : 0.1}
              min={param === 'largeArc' || param === 'sweep' ? 0 : undefined}
              max={param === 'largeArc' || param === 'sweep' ? 1 : undefined}
              value={segment.values[i] ?? 0}
              onChange={(e) => handleValueChange(i, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// Preview Component with zoom/pan
function Preview({
  pathD,
  fill,
  stroke,
  strokeWidth,
  strokeLinecap,
  strokeLinejoin,
  transform,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);

  const [state, setState] = usePreviewState();

  const handleWheel = (e) => {
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;

    const wrap = wrapRef.current;
    const rect = wrap.getBoundingClientRect();

    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const w = state.w * state.zoom;
    const h = state.h * state.zoom;

    const newW = w * scaleFactor;
    const newH = h * scaleFactor;

    const diffX = xRatio * w - xRatio * newW;
    const diffY = yRatio * h - yRatio * newH;

    setState({
      x: state.x + diffX,
      y: state.y + diffY,
      zoom: state.zoom * scaleFactor,
    });
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setState({ isPanning: true, panStartX: e.clientX, panStartY: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!state.isPanning) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    const mouseX = e.clientX - state.panStartX;
    const mouseY = e.clientY - state.panStartY;

    const dx = (mouseX / rect.width) * state.w * state.zoom;
    const dy = (mouseY / rect.height) * state.h * state.zoom;

    setState({
      x: state.x - dx,
      y: state.y - dy,
      panStartX: e.clientX,
      panStartY: e.clientY,
    });
  };

  const handleMouseUp = () => setState({ isPanning: false });

  const resetView = () => {
    const wrap = wrapRef.current;
    return setState({
      ...initState,
      w: wrap.clientWidth,
      h: wrap.clientHeight,
    });
  };

  const zoomOut = () => setState({ zoom: state.zoom / 1.2 });
  const zoomIn = () => setState({ zoom: state.zoom * 1.2 });

  useEffect(() => {
    const wrap = wrapRef.current;
    setState({ w: wrap.clientWidth, h: wrap.clientHeight });

    const resizer = new ResizeObserver(() => {
      setState({ w: wrap.clientWidth, h: wrap.clientHeight });
    });
    resizer.observe(wrap);

    return () => resizer.disconnect();
  }, []);

  return (
    <div className="preview-container">
      <div className="preview-toolbar">
        <button onClick={resetView} title="Reset View">
          <span className="btn-icon">⟲</span>
        </button>
        <button onClick={zoomOut} title="Zoom In">
          <span className="btn-icon">+</span>
        </button>
        <button onClick={zoomIn} title="Zoom Out">
          <span className="btn-icon">−</span>
        </button>
        <span className="zoom-level">{~~((1 / state.zoom) * 100)}%</span>
      </div>
      <div ref={wrapRef} className="preview-wrap">
        <svg
          ref={svgRef}
          className="preview-svg"
          viewBox={[
            state.x,
            state.y,
            state.w * state.zoom,
            state.h * state.zoom,
          ].join(' ')}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Grid */}
          <defs>
            <pattern
              id="smallGrid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern
              id="grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <rect width="50" height="50" fill="url(#smallGrid)" />
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect
            x={state.x}
            y={state.y}
            width={state.w * state.zoom}
            height={state.h * state.zoom}
            fill="url(#grid)"
          />

          {/* Axes */}
          <line
            x1={state.x}
            y1="0"
            x2={state.x + state.w * state.zoom}
            y2="0"
            stroke="rgba(239,68,68,0.4)"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={state.y}
            x2="0"
            y2={state.y + state.h * state.zoom}
            stroke="rgba(34,197,94,0.4)"
            strokeWidth="1"
          />
          <circle cx="0" cy="0" r="3" fill="rgba(255,255,255,0.5)" />

          {/* The Path */}
          <g transform={transform}>
            <path
              d={pathD}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap={strokeLinecap}
              strokeLinejoin={strokeLinejoin}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
      </div>
      <div className="preview-info">
        <span>Drag to pan • Scroll to zoom</span>
      </div>
    </div>
  );
}

// Main App Component
window.SVGPathInspector = function SVGPathInspector() {
  const [rawPath, setRawPath] = useState(
    'M7 11.0595C7 13.6018 9.00971 14.9566 10.4809 16.1692C11 16.5971 11.5 17 12 17C12.5 17 13 16.5971 13.5191 16.1692C14.9903 14.9566 17 13.6018 17 11.0595C17 8.51718 14.2499 6.71421 12 9.15837C9.75008 6.71421 7 8.51718 7 11.0595Z',
  );
  const [segments, setSegments] = useState(() => parsePath(rawPath));
  const [fill, setFill] = useState('none');
  const [stroke, setStroke] = useState('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState(20);
  const [strokeLinecap, setStrokeLinecap] = useState('butt');
  const [strokeLinejoin, setStrokeLinejoin] = useState('miter');
  const [transform, setTransform] = useState('scale(20)');

  // Sync raw path input with segments
  const handleRawPathChange = (value) => {
    setRawPath(value);
    const parsed = parsePath(value);
    if (parsed.length > 0) {
      setSegments(parsed);
    }
  };

  // Update segments and sync to raw path
  const updateSegment = (index, newSegment) => {
    const newSegments = [...segments];
    newSegments[index] = newSegment;
    setSegments(newSegments);
    setRawPath(segmentsToPath(newSegments));
  };

  const deleteSegment = (index) => {
    if (segments.length <= 1) return;
    const newSegments = segments.filter((_, i) => i !== index);
    setSegments(newSegments);
    setRawPath(segmentsToPath(newSegments));
  };

  const insertSegment = (index, newSegment) => {
    const newSegments = [...segments];
    newSegments.splice(index, 0, newSegment);
    setSegments(newSegments);
    setRawPath(segmentsToPath(newSegments));
  };

  const pathD = segmentsToPath(segments);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>SVG Path Inspector</h1>
          <div className="path-input-container">
            <textarea
              className="path-input"
              value={rawPath}
              onChange={(e) => handleRawPathChange(e.target.value)}
              placeholder="Paste path d attribute here..."
              spellCheck={false}
            />
          </div>
        </div>

        <div className="options-section">
          <div className="option-group">
            <label className="option-label">Fill</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-swatch"
                value={fill === 'none' ? '#000000' : fill}
                onChange={(e) => setFill(e.target.value)}
              />
              <input
                type="text"
                className="option-input"
                value={fill}
                onChange={(e) => setFill(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="option-group">
            <label className="option-label">Stroke</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-swatch"
                value={stroke}
                onChange={(e) => setStroke(e.target.value)}
              />
              <input
                type="text"
                className="option-input"
                value={stroke}
                onChange={(e) => setStroke(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="option-group stroke-options">
            <div className="stroke-option">
              <label className="option-label">Width</label>
              <input
                type="number"
                className="option-input"
                value={strokeWidth}
                min={0}
                step={0.5}
                onChange={(e) =>
                  setStrokeWidth(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="stroke-option">
              <label className="option-label">Cap</label>
              <select
                className="option-input"
                value={strokeLinecap}
                onChange={(e) => setStrokeLinecap(e.target.value)}
              >
                <option value="butt">butt</option>
                <option value="round">round</option>
                <option value="square">square</option>
              </select>
            </div>
            <div className="stroke-option">
              <label className="option-label">Join</label>
              <select
                className="option-input"
                value={strokeLinejoin}
                onChange={(e) => setStrokeLinejoin(e.target.value)}
              >
                <option value="miter">miter</option>
                <option value="round">round</option>
                <option value="bevel">bevel</option>
              </select>
            </div>
          </div>

          <div className="option-group full-width">
            <label className="option-label">Transform</label>
            <input
              type="text"
              className="option-input"
              value={transform}
              onChange={(e) => setTransform(e.target.value)}
              placeholder="e.g. rotate(45)"
            />
          </div>
        </div>

        <div className="segments-header">
          <h2>Path Segments</h2>
          <span className="segment-count">{segments.length}</span>
        </div>

        <div className="segments-list">
          {segments.map((segment, index) => (
            <SegmentRow
              key={segment.id}
              segment={segment}
              index={index}
              onUpdate={updateSegment}
              onDelete={deleteSegment}
              onInsert={insertSegment}
              totalSegments={segments.length}
            />
          ))}
        </div>
      </aside>

      {/* Preview */}
      <Preview
        pathD={pathD}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
        transform={transform}
      />
    </div>
  );
};

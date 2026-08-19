"use client";

import { useEffect, useRef, useState } from "react";

type Item = {
  id: number;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

type PageSize = {
  width: number;
  height: number;
};

const PAGE_SIZES: Record<string, PageSize> = {
  "8.5x11": { width: 8.5, height: 11 },
  "11x8.5": { width: 11, height: 8.5 },
  "8.27x11.69": { width: 8.27, height: 11.69 },
  "11.69x8.27": { width: 11.69, height: 8.27 },
  "4x6": { width: 4, height: 6 },
  "6x4": { width: 6, height: 4 },
  "8x8": { width: 8, height: 8 },
};

const GRID = 20;
const DPI_RENDER = 96;

export default function Page() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zTop, setZTop] = useState(10);

  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const [pageSizeKey, setPageSizeKey] = useState("8.5x11");

  const [pageDimensions, setPageDimensions] = useState({
    width: 816,
    height: 1056,
  });

  const pageSize = PAGE_SIZES[pageSizeKey];

  /*
   * ------------------------------------------------------------
   * Page sizing
   * ------------------------------------------------------------
   */

  useEffect(() => {
    function layoutPage() {
      const viewport = viewportRef.current;

      if (!viewport) return;

      const availW = viewport.clientWidth - 80;
      const availH = viewport.clientHeight - 80;

      const scale = Math.min(
        availW / pageSize.width,
        availH / pageSize.height,
        DPI_RENDER
      );

      setPageDimensions({
        width: pageSize.width * scale,
        height: pageSize.height * scale,
      });
    }

    layoutPage();

    window.addEventListener("resize", layoutPage);

    return () => {
      window.removeEventListener("resize", layoutPage);
    };
  }, [pageSize.width, pageSize.height]);

  /*
   * ------------------------------------------------------------
   * Add images
   * ------------------------------------------------------------
   */

  function handleAddImages() {
    fileInputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const src = event.target?.result;

        if (typeof src !== "string") return;

        const img = new Image();

        img.onload = () => {
          const pageW = pageDimensions.width;
          const pageH = pageDimensions.height;

          const maxDim = Math.min(pageW, pageH) * 0.45;

          let width = img.naturalWidth;
          let height = img.naturalHeight;

          const ratio = Math.min(
            maxDim / width,
            maxDim / height,
            1
          );

          width *= ratio;
          height *= ratio;

          const x =
            (pageW - width) / 2 +
            index * 18;

          const y =
            (pageH - height) / 2 +
            index * 18;

          const newZ = zTop + index + 1;

          const newItem: Item = {
            id: Date.now() + index,
            src,
            x,
            y,
            width,
            height,
            rotation: 0,
            zIndex: newZ,
          };

          setItems((prev) => [...prev, newItem]);
          setSelectedId(newItem.id);
        };

        img.src = src;
      };

      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setZTop((prev) => prev + files.length);
  }

  /*
   * ------------------------------------------------------------
   * Item selection
   * ------------------------------------------------------------
   */

  function selectItem(id: number | null) {
    setSelectedId(id);

    if (id !== null) {
      setZTop((prev) => {
        const next = prev + 1;

        setItems((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, zIndex: next }
              : item
          )
        );

        return next;
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * Delete
   * ------------------------------------------------------------
   */

  function deleteItem(id: number) {
    setItems((prev) =>
      prev.filter((item) => item.id !== id)
    );

    if (selectedId === id) {
      setSelectedId(null);
    }
  }

  /*
   * ------------------------------------------------------------
   * Drag / Resize / Rotate
   * ------------------------------------------------------------
   */

  function handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    item: Item
  ) {
    e.stopPropagation();

    selectItem(item.id);

    const target = e.target as HTMLElement;

    const startX = e.clientX;
    const startY = e.clientY;

    const startLeft = item.x;
    const startTop = item.y;

    const startWidth = item.width;
    const startHeight = item.height;

    const element = e.currentTarget;

    const rect = element.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startRotation = item.rotation;

    const startAngle =
      Math.atan2(
        startY - centerY,
        startX - centerX
      ) *
      (180 / Math.PI);

    let mode: "move" | "resize" | "rotate" = "move";

    if (target.classList.contains("h-br")) {
      mode = "resize";
    } else if (target.classList.contains("h-rot")) {
      mode = "rotate";
    }

    function handleMove(ev: PointerEvent) {
      if (mode === "move") {
        let x =
          startLeft +
          (ev.clientX - startX);

        let y =
          startTop +
          (ev.clientY - startY);

        if (snapEnabled) {
          x = Math.round(x / GRID) * GRID;
          y = Math.round(y / GRID) * GRID;
        }

        setItems((prev) =>
          prev.map((current) =>
            current.id === item.id
              ? {
                  ...current,
                  x,
                  y,
                }
              : current
          )
        );
      }

      if (mode === "resize") {
        let width = Math.max(
          20,
          startWidth +
            (ev.clientX - startX)
        );

        let height = Math.max(
          20,
          startHeight +
            (ev.clientY - startY)
        );

        if (snapEnabled) {
          width =
            Math.round(width / GRID) *
            GRID;

          height =
            Math.round(height / GRID) *
            GRID;
        }

        setItems((prev) =>
          prev.map((current) =>
            current.id === item.id
              ? {
                  ...current,
                  width,
                  height,
                }
              : current
          )
        );
      }

      if (mode === "rotate") {
        const angle =
          Math.atan2(
            ev.clientY - centerY,
            ev.clientX - centerX
          ) *
          (180 / Math.PI);

        let rotation =
          startRotation +
          (angle - startAngle);

        if (snapEnabled) {
          rotation =
            Math.round(rotation / 15) *
            15;
        }

        setItems((prev) =>
          prev.map((current) =>
            current.id === item.id
              ? {
                  ...current,
                  rotation,
                }
              : current
          )
        );
      }
    }

    function handleUp() {
      window.removeEventListener(
        "pointermove",
        handleMove
      );

      window.removeEventListener(
        "pointerup",
        handleUp
      );
    }

    window.addEventListener(
      "pointermove",
      handleMove
    );

    window.addEventListener(
      "pointerup",
      handleUp
    );
  }

  /*
   * ------------------------------------------------------------
   * Arrange
   * ------------------------------------------------------------
   */

  function bringToFront() {
    if (selectedId === null) return;

    const newZ = zTop + 1;

    setZTop(newZ);

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedId
          ? {
              ...item,
              zIndex: newZ,
            }
          : item
      )
    );
  }

  function sendToBack() {
    if (selectedId === null) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedId
          ? {
              ...item,
              zIndex: 1,
            }
          : item
      )
    );
  }

  function resetRotation() {
    if (selectedId === null) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedId
          ? {
              ...item,
              rotation: 0,
            }
          : item
      )
    );
  }

  /*
   * ------------------------------------------------------------
   * Fit selected image to page
   * ------------------------------------------------------------
   */

  function fitToPage() {
    if (selectedId === null) return;

    const selected = items.find(
      (item) => item.id === selectedId
    );

    if (!selected) return;

    const img = new Image();

    img.onload = () => {
      const pageW = pageDimensions.width;
      const pageH = pageDimensions.height;

      const ratio =
        img.naturalWidth /
        img.naturalHeight;

      let width = pageW * 0.9;
      let height = width / ratio;

      if (height > pageH * 0.9) {
        height = pageH * 0.9;
        width = height * ratio;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                width,
                height,
                x: (pageW - width) / 2,
                y: (pageH - height) / 2,
                rotation: 0,
              }
            : item
        )
      );
    };

    img.src = selected.src;
  }

  /*
   * ------------------------------------------------------------
   * Clear
   * ------------------------------------------------------------
   */

  function clearPage() {
    const confirmed = window.confirm(
      "Remove all images from the page?"
    );

    if (!confirmed) return;

    setItems([]);
    setSelectedId(null);
  }

  /*
   * ------------------------------------------------------------
   * Print
   * ------------------------------------------------------------
   */

  function printPage() {
    setSelectedId(null);

    setTimeout(() => {
      window.print();
    }, 50);
  }

  /*
   * ------------------------------------------------------------
   * Keyboard delete
   * ------------------------------------------------------------
   */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;

      if (
        (e.key === "Delete" ||
          e.key === "Backspace") &&
        selectedId !== null &&
        target.tagName !== "INPUT"
      ) {
        deleteItem(selectedId);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedId]);

  return (
    <>
      <style jsx global>{`
        :root {
          --ink: #1e1f22;
          --graphite: #2b2d31;
          --graphite-2: #38393e;
          --paper: #fafaf7;
          --paper-shadow: rgba(0, 0, 0, 0.28);
          --mark: #c0392b;
          --line: #4a4c52;
          --text-dim: #9a9ca3;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          height: 100%;
          background: var(--graphite);
          font-family:
            "Helvetica Neue",
            Arial,
            sans-serif;
          color: #f2f2f0;
          overflow: hidden;
        }

        #__next {
          height: 100%;
        }

        .app {
          display: flex;
          height: 100vh;
          width: 100vw;
        }

        /* Sidebar */

        .sidebar {
          width: 240px;
          flex-shrink: 0;
          background: var(--ink);
          border-right: 1px solid #000;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          overflow-y: auto;
        }

        .brand {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--line);
        }

        .brand .mark {
          color: var(--mark);
          font-family: "Courier New", monospace;
          font-size: 13px;
          letter-spacing: 1px;
        }

        .brand h1 {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.3px;
          margin: 0;
          text-transform: uppercase;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-dim);
          font-family: "Courier New", monospace;
        }

        select,
        .btn {
          width: 100%;
          background: var(--graphite);
          color: #f2f2f0;
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 9px 10px;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          transition:
            border-color 0.15s,
            background 0.15s;
        }

        select:hover,
        .btn:hover {
          border-color: #7a7c82;
          background: var(--graphite-2);
        }

        .btn-row {
          display: flex;
          gap: 8px;
        }

        .btn-row .btn {
          flex: 1;
        }

        .btn.primary {
          background: var(--mark);
          border-color: var(--mark);
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .btn.primary:hover {
          background: #a8331f;
          border-color: #a8331f;
        }

        .btn.ghost {
          background: transparent;
        }

        input[type="file"] {
          display: none;
        }

        .toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-dim);
        }

        .switch {
          width: 34px;
          height: 18px;
          background: var(--graphite-2);
          border: 1px solid var(--line);
          border-radius: 10px;
          position: relative;
          cursor: pointer;
          flex-shrink: 0;
        }

        .switch::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--text-dim);
          transition:
            left 0.15s,
            background 0.15s;
        }

        .switch.on {
          border-color: var(--mark);
        }

        .switch.on::after {
          left: 17px;
          background: var(--mark);
        }

        .spacer {
          flex: 1;
        }

        .hint {
          font-size: 11px;
          line-height: 1.5;
          color: var(--text-dim);
          border-top: 1px solid var(--line);
          padding-top: 14px;
        }

        .count-badge {
          font-family: "Courier New", monospace;
          font-size: 11px;
          color: var(--text-dim);
        }

        /* Canvas */

        .viewport {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          padding: 40px;
          background:
            radial-gradient(
              circle at 1px 1px,
              #3a3c42 1px,
              transparent 0
            )
            0 0 / 22px 22px,
            var(--graphite);
        }

        .page-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .page {
          position: relative;
          background: var(--paper);
          box-shadow:
            0 18px 50px var(--paper-shadow),
            0 2px 6px rgba(0, 0, 0, 0.35);
          overflow: hidden;
        }

        /* Crop marks */

        .crop {
          position: absolute;
          width: 16px;
          height: 16px;
          pointer-events: none;
          z-index: 500;
        }

        .crop::before,
        .crop::after {
          content: "";
          position: absolute;
          background: var(--mark);
        }

        .crop::before {
          width: 16px;
          height: 1px;
          top: 7.5px;
          left: 0;
        }

        .crop::after {
          width: 1px;
          height: 16px;
          left: 7.5px;
          top: 0;
        }

        .crop.tl {
          top: -8px;
          left: -8px;
        }

        .crop.tr {
          top: -8px;
          right: -8px;
        }

        .crop.bl {
          bottom: -8px;
          left: -8px;
        }

        .crop.br {
          bottom: -8px;
          right: -8px;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(
              to right,
              rgba(192, 57, 38, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(192, 57, 38, 0.08) 1px,
              transparent 1px
            );
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 1;
        }

        .empty-msg {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 10px;
          color: #c9c9c4;
          font-size: 13px;
          text-align: center;
          padding: 40px;
          pointer-events: none;
        }

        .empty-msg .big {
          font-family: "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #b7b7b0;
        }

        /* Images */

        .item {
          position: absolute;
          cursor: grab;
          z-index: 10;
          outline: 1px dashed transparent;
          touch-action: none;
        }

        .item.selected {
          outline-color: var(--mark);
        }

        .item img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: fill;
          user-select: none;
          -webkit-user-drag: none;
          pointer-events: none;
        }

        .handle {
          position: absolute;
          width: 11px;
          height: 11px;
          background: var(--mark);
          border: 1.5px solid var(--paper);
          border-radius: 50%;
          display: none;
        }

        .item.selected .handle {
          display: block;
        }

        .h-br {
          right: -6px;
          bottom: -6px;
          cursor: nwse-resize;
        }

        .h-rot {
          left: 50%;
          top: -26px;
          transform: translateX(-50%);
          cursor: grab;
        }

        .rot-line {
          position: absolute;
          left: 50%;
          top: -16px;
          width: 1px;
          height: 16px;
          background: var(--mark);
          display: none;
        }

        .item.selected .rot-line {
          display: block;
        }

        .del {
          position: absolute;
          top: -11px;
          right: -11px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--ink);
          border: 1.5px solid var(--paper);
          color: #f2f2f0;
          font-size: 12px;
          line-height: 1;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 20;
        }

        .item.selected .del {
          display: flex;
        }

        @media print {
          body * {
            visibility: hidden;
          }

          .page,
          .page * {
            visibility: visible;
          }

          .page {
            box-shadow: none !important;
            position: absolute;
            top: 0;
            left: 0;
            margin: 0;

            width: ${pageSize.width}in !important;
            height: ${pageSize.height}in !important;
          }

          .crop,
          .grid-overlay,
          .handle,
          .del,
          .rot-line,
          .item {
            outline: none !important;
          }

          .handle,
          .del,
          .rot-line {
            display: none !important;
          }

          .sidebar,
          .empty-msg {
            display: none !important;
          }
        }
      `}</style>

      <main className="app">
        {/* Sidebar */}

        <aside className="sidebar">
          <div className="brand">
            <span className="mark">✕</span>
            <h1>Layout &amp; Print</h1>
          </div>

          <div className="field">
            <label>Add images</label>

            <button
              className="btn primary"
              onClick={handleAddImages}
            >
              + Add Images
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                handleFiles(e.target.files)
              }
            />
          </div>

          <div className="field">
            <label>Page size</label>

            <select
              value={pageSizeKey}
              onChange={(e) =>
                setPageSizeKey(e.target.value)
              }
            >
              <option value="8.5x11">
                Letter — 8.5 × 11 in
              </option>

              <option value="11x8.5">
                Letter — 11 × 8.5 in
              </option>

              <option value="8.27x11.69">
                A4 — 210 × 297 mm
              </option>

              <option value="11.69x8.27">
                A4 — 297 × 210 mm
              </option>

              <option value="4x6">
                Photo — 4 × 6 in
              </option>

              <option value="6x4">
                Photo — 6 × 4 in
              </option>

              <option value="8x8">
                Square — 8 × 8 in
              </option>
            </select>
          </div>

          <div className="field">
            <div className="toggle">
              <span>Snap to grid</span>

              <div
                className={`switch ${
                  snapEnabled ? "on" : ""
                }`}
                onClick={() =>
                  setSnapEnabled(
                    (prev) => !prev
                  )
                }
              />
            </div>

            <div className="toggle">
              <span>Show grid</span>

              <div
                className={`switch ${
                  showGrid ? "on" : ""
                }`}
                onClick={() =>
                  setShowGrid(
                    (prev) => !prev
                  )
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Arrange</label>

            <div className="btn-row">
              <button
                className="btn ghost"
                onClick={bringToFront}
              >
                Front
              </button>

              <button
                className="btn ghost"
                onClick={sendToBack}
              >
                Back
              </button>
            </div>

            <div className="btn-row">
              <button
                className="btn ghost"
                onClick={fitToPage}
              >
                Fit to page
              </button>

              <button
                className="btn ghost"
                onClick={resetRotation}
              >
                Reset rotate
              </button>
            </div>
          </div>

          <span className="count-badge">
            {items.length} image
            {items.length === 1 ? "" : "s"} on page
          </span>

          <div className="spacer" />

          <button
            className="btn primary"
            style={{
              fontSize: "14px",
              padding: "12px",
            }}
            onClick={printPage}
          >
            🖨 Print
          </button>

          <button
            className="btn ghost"
            onClick={clearPage}
          >
            Clear page
          </button>

          <div className="hint">
            Drag images to position them. Drag
            the corner dot to resize, the top
            dot to rotate. Click Print — only
            the page area is sent to the
            printer, exactly as arranged.
          </div>
        </aside>

        {/* Canvas */}

        <div
          ref={viewportRef}
          className="viewport"
        >
          <div className="page-wrap">
            <div className="crop tl" />
            <div className="crop tr" />
            <div className="crop bl" />
            <div className="crop br" />

            <div
              ref={pageRef}
              className="page"
              style={{
                width: pageDimensions.width,
                height: pageDimensions.height,
              }}
              onPointerDown={(e) => {
                if (
                  e.target === e.currentTarget
                ) {
                  setSelectedId(null);
                }
              }}
            >
              {showGrid && (
                <div className="grid-overlay" />
              )}

              {items.length === 0 && (
                <div className="empty-msg">
                  <div className="big">
                    Blank page
                  </div>

                  <div>
                    Add images to start arranging
                  </div>
                </div>
              )}

              {items.map((item) => (
                <div
                  key={item.id}
                  className={`item ${
                    selectedId === item.id
                      ? "selected"
                      : ""
                  }`}
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    transform: `rotate(${item.rotation}deg)`,
                    zIndex: item.zIndex,
                  }}
                  onPointerDown={(e) =>
                    handlePointerDown(
                      e,
                      item
                    )
                  }
                >
                  <img
                    src={item.src}
                    draggable={false}
                    alt=""
                  />

                  <div className="rot-line" />

                  <div
                    className="handle h-rot"
                    title="Rotate"
                  />

                  <div
                    className="handle h-br"
                    title="Resize"
                  />

                  <button
                    className="del"
                    title="Delete"
                    onPointerDown={(e) =>
                      e.stopPropagation()
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
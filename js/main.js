/**
 * main.js — 应用入口与调度：
 * 1) 初始化 WebGL2 上下文与三个渲染器；
 * 2) 维护全局状态（分形类型 / 渲染模式 / 相机 / 动画）；
 * 3) 驱动 requestAnimationFrame 渲染循环（含逐点生长动画）；
 * 4) 把面板（UI）与输入（interaction）的事件归一化为对状态与几何缓存的更新。
 *
 * 模块划分：几何=fractals.js，配色=palettes.js，渲染=gasket2d/tetra/mandelbrot.js，
 * 交互=input.js，UI=panel.js。本文件只负责编排，不重复实现算法。
 */
'use strict';
(function () {
    const $ = (id) => document.getElementById(id);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------- 全局状态 ----------
    const state = {
        fractalType: 'sierpinski',   // sierpinski | ngon | tetra | mandelbrot
        renderMode: 'points',        // points | wireframe | solid
        numPoints: 20000,
        depth: 4,
        pointSize: 3,
        colorScheme: 'mono',
        ngonSides: 5,
        ratio: 0.61803398875,
        mb: { iter: 300, mode: 0, cx: -0.4, cy: 0.6, palette: 0 },
        anim: { speed: 20000, playing: true, shown: 0 },
        camera: { panX: 0, panY: 0, zoom: 1.5 },   // 2D 相机（Mandelbrot 复用 center/scale）
        tetraZoom: 1.3,
        rotX: 0.5, rotY: 0.7
    };

    // ---------- WebGL 初始化 ----------
    const canvas = $('glCanvas');
    const gl = webglUtils.setupWebGL(canvas);
    const g2d = new Gasket2DRenderer(gl);      // 2D 垫片
    const tetra = new TetraRenderer(gl);       // 3D 四面体
    const mander = new MandelbrotRenderer(gl); // Mandelbrot/Julia

    // 几何 / 缓冲上传缓存：参数不变则不重建
    const cache = {
        chaos: { key: '', positions: null, source: null, colors: null, uploaded: '' },
        rec2d: { key: '', indexed: null, colors: null, uploaded: '' },
        tetra: { key: '', solid: null, lines: null, uploaded: '' }
    };
    let aspectNow = 1;

    // ---------- 画布尺寸 ----------
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w > 0 && h > 0 &&
            (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        aspectNow = canvas.width / canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        return aspectNow;
    }

    // ---------- 几何重建 ----------
    function rebuildChaos() {
        const isNgon = state.fractalType === 'ngon';
        const polygon = isNgon ? FractalGeometry.regularPolygon(state.ngonSides, 1) : FractalGeometry.TRI;
        const ratio = isNgon ? state.ratio : 0.5;
        const key = state.fractalType + '|' + state.numPoints + '|' + state.ngonSides + '|' + ratio.toFixed(4) + '|' + state.colorScheme;
        if (cache.chaos.key === key) return;
        const gen = FractalGeometry.chaosGame(polygon, state.numPoints, ratio);
        const colors = Palettes.colorizeChaos(gen.positions, gen.source, state.colorScheme);
        cache.chaos = { key, positions: gen.positions, source: gen.source, colors, uploaded: '' };
        state.anim.shown = 0;
    }

    function rebuildRec2D() {
        const key = state.depth + '|' + state.colorScheme;
        if (cache.rec2d.key === key) return;
        const tris = FractalGeometry.subdivideTriangle(FractalGeometry.TRI, state.depth);
        const idx = FractalGeometry.gasketIndexed(tris);
        const colors = Palettes.colorizePositions(idx.vertices, state.colorScheme);
        cache.rec2d = { key, indexed: idx, colors, uploaded: '' };
    }

    function rebuildTetra() {
        const key = state.depth;
        if (cache.tetra.key === key) return;
        const base = FractalGeometry.makeTetrahedron();
        const solid = FractalGeometry.tetraRenderData(
            FractalGeometry.subdivideTetra(base, state.depth), 'solid');
        const lines = FractalGeometry.tetraRenderData(
            FractalGeometry.subdivideTetra(base, state.depth), 'lines');
        cache.tetra = { key, solid, lines, uploaded: '' };
    }

    // ---------- 参数变更 ----------
    const applyChange = (key, value) => {
        switch (key) {
            case 'fractalType': state.fractalType = value; resetView(); break;
            case 'renderMode': state.renderMode = value; panel.setActiveMode(value); break;
            case 'numPoints':  state.numPoints = value; cache.chaos.key = ''; break;
            case 'depth':      state.depth = value; cache.rec2d.key = ''; cache.tetra.key = ''; break;
            case 'colorScheme': state.colorScheme = value; cache.chaos.key = ''; cache.rec2d.key = ''; break;
            case 'ngonSides':  state.ngonSides = value; cache.chaos.key = ''; break;
            case 'ratio':      state.ratio = value; cache.chaos.key = ''; break;
            case 'pointSize':  state.pointSize = value; break;
            case 'mbIter':     state.mb.iter = value; break;
            case 'mbMode':     state.mb.mode = Number(value); break;
            case 'mbCx':       state.mb.cx = value; break;
            case 'mbCy':       state.mb.cy = value; break;
            case 'mbPalette':  state.mb.palette = Number(value); break;
            case 'speed':      state.anim.speed = value; break;
            case 'toggleAnim': state.anim.playing = !state.anim.playing; break;
            default: break;
        }
        refreshGroups();
        syncInfo();
    };

    // 依据当前分形类型显示/隐藏参数分组、设置渲染模式按钮可用性
    function refreshGroups() {
        const t = state.fractalType;
        panel.applyGroups({
            points: t === 'sierpinski' || t === 'ngon',
            depth: t === 'sierpinski' || t === 'tetra',
            ngon: t === 'ngon',
            mandelbrot: t === 'mandelbrot',
            anim: t === 'sierpinski' || t === 'ngon'
        });
        panel.modeBtns.forEach((b) => {
            const m = b.getAttribute('data-mode');
            let enabled = true;
            if (t === 'mandelbrot') enabled = false;
            if (t === 'tetra') enabled = (m === 'wireframe' || m === 'solid');
            b.disabled = !enabled;
        });
        if (t === 'tetra' && state.renderMode === 'points') { state.renderMode = 'solid'; panel.setActiveMode('solid'); }
        if (t === 'mandelbrot') { state.renderMode = 'points'; panel.setActiveMode('points'); }
    }

    function resetView() {
        switch (state.fractalType) {
            case 'sierpinski': state.camera = { panX: 0, panY: 0, zoom: 1.5 }; break;
            case 'ngon':       state.camera = { panX: 0, panY: 0, zoom: 1.0 }; break;
            case 'tetra':      state.tetraZoom = 1.3; state.rotX = 0.5; state.rotY = 0.7; break;
            case 'mandelbrot': state.camera = { panX: -0.5, panY: 0, zoom: 1.0 }; break;
        }
    }

    // ---------- 交互事件 -> 状态 ----------
    function cameraDrag(dx, dy) {
        if (state.fractalType === 'mandelbrot') {
            const scale = 2.7 / state.camera.zoom;
            state.camera.panX -= dx / aspectNow * scale;
            state.camera.panY -= dy * scale;
        } else {
            state.camera.panX += dx * aspectNow / state.camera.zoom;
            state.camera.panY += dy / state.camera.zoom;
        }
    }
    function cameraZoom(factor, cx, cy) {
        if (state.fractalType === 'tetra') { state.tetraZoom = clamp(state.tetraZoom * factor, 0.2, 8); return; }
        const c = state.camera;
        if (state.fractalType === 'mandelbrot') {
            const scale = 2.7 / c.zoom;
            const zx = c.panX + (cx / aspectNow) * scale;
            const zy = c.panY + cy * scale;
            const nz = scale / factor;
            c.zoom = clamp(2.7 / nz, 0.1, 1e5);
            c.panX = zx - (cx / aspectNow) * nz;
            c.panY = zy - cy * nz;
        } else {
            const wx = (cx * aspectNow - c.panX) / c.zoom;
            const wy = (cy - c.panY) / c.zoom;
            c.zoom = clamp(c.zoom * factor, 0.05, 60);
            c.panX = cx * aspectNow - wx * c.zoom;
            c.panY = cy - wy * c.zoom;
        }
    }
    function tetraRotate(dx, dy) {
        state.rotX = clamp(state.rotX + dy * 2.0, -1.4, 1.4);
        state.rotY += dx * 2.0;
    }

    const input = new InputController(canvas, {
        drag: (dx, dy) => { state.fractalType === 'tetra' ? tetraRotate(dx, dy) : cameraDrag(dx, dy); },
        zoom: (f, cx, cy) => cameraZoom(f, cx, cy),
        key: (code, ev) => {
            if (code === 'Digit1') applyChange('renderMode', 'points');
            else if (code === 'Digit2') applyChange('renderMode', 'wireframe');
            else if (code === 'Digit3') applyChange('renderMode', 'solid');
            else if (code === 'Space') { ev.preventDefault(); applyChange('toggleAnim', null); }
            else if (code === 'KeyR') resetView();
            else if (code === 'KeyC') {
                const list = Palettes.schemes.map(s => s.id);
                const i = (list.indexOf(state.colorScheme) + 1) % list.length;
                const sel = document.querySelector('#colorScheme');
                sel.value = list[i];
                applyChange('colorScheme', list[i]);
            }
        }
    });

    const panel = new ControlPanel($('panel'), applyChange);

    // ---------- 渲染循环 ----------
    let lastT = 0, fps = 60;

    function frame(t) {
        const dt = Math.min((t - lastT) / 1000 || 0.016, 0.1);
        lastT = t;
        const aspect = resize();
        const pt = state.pointSize;

        gl.disable(gl.DEPTH_TEST);
        gl.clearColor(0.05, 0.06, 0.08, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const isSierpinski = state.fractalType === 'sierpinski';
        const isNgon = state.fractalType === 'ngon';

        // 逐点生长动画只作用于点云模式（混沌游戏）
        if ((isSierpinski && state.renderMode === 'points') || isNgon) {
            rebuildChaos();
            if (state.anim.playing) {
                state.anim.shown = Math.min(cache.chaos.positions.length / 2,
                    state.anim.shown + state.anim.speed * dt);
            }
            if (cache.chaos.uploaded !== cache.chaos.key) {
                g2d.setData(cache.chaos.positions, cache.chaos.colors);
                cache.chaos.uploaded = cache.chaos.key;
            }
            g2d.drawArrays(Math.floor(state.anim.shown), state.camera, pt, aspect);
        } else if (isSierpinski) {
            // 递归细分（点/线/面共用同一组三角形）
            rebuildRec2D();
            if (cache.rec2d.uploaded !== cache.rec2d.key) {
                g2d.setData(cache.rec2d.indexed.vertices, cache.rec2d.colors);
                cache.rec2d.uploaded = cache.rec2d.key;
            }
            const idx = cache.rec2d.indexed;
            const which = state.renderMode === 'wireframe' ? idx.line
                : state.renderMode === 'solid' ? idx.tri : idx.point;
            g2d.useIndices(which);
            g2d.drawIndexed(
                state.renderMode === 'wireframe' ? 'lines'
                    : state.renderMode === 'solid' ? 'triangles' : 'points',
                state.camera, pt, aspect);
        } else if (state.fractalType === 'tetra') {
            gl.enable(gl.DEPTH_TEST);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            rebuildTetra();
            const mode = state.renderMode === 'wireframe' ? 'lines' : 'solid';
            const rd = mode === 'lines' ? cache.tetra.lines : cache.tetra.solid;
            if (cache.tetra.uploaded !== cache.tetra.key + mode) {
                tetra.setData(rd);
                cache.tetra.uploaded = cache.tetra.key + mode;
            }
            const M = window.MV;
            const model = M.mult(M.mult(M.rotateX(state.rotX), M.rotateY(state.rotY)),
                M.scale(state.tetraZoom, state.tetraZoom, state.tetraZoom));
            const view = M.lookAt([0, 0, 3.2], [0, 0, 0], [0, 1, 0]);
            const proj = M.perspective(0.8, aspect, 0.1, 20);
            const mvp = M.mult(proj, M.mult(view, model));
            tetra.draw(mvp, pt);
        } else if (state.fractalType === 'mandelbrot') {
            mander.draw({
                centerX: state.camera.panX, centerY: state.camera.panY,
                scale: 2.7 / state.camera.zoom, aspect,
                iter: state.mb.iter, mode: state.mb.mode,
                cx: state.mb.cx, cy: state.mb.cy, palette: state.mb.palette
            });
        }

        fps = fps * 0.9 + (1 / dt) * 0.1;
        updateInfo();
        requestAnimationFrame(frame);
    }

    function updateInfo() {
        const t = state.fractalType;
        let extra = '';
        if (t === 'sierpinski') extra = state.renderMode === 'points'
            ? `点云 ${Math.floor(state.anim.shown)}/${cache.chaos.positions.length / 2}`
            : `递归深度 ${state.depth}`;
        else if (t === 'ngon') extra = `${state.ngonSides}边形 点云 ${Math.floor(state.anim.shown)}`;
        else if (t === 'tetra') extra = `四面体 深度 ${state.depth}`;
        else if (t === 'mandelbrot') extra = `${state.mb.mode === 0 ? 'Mandelbrot' : 'Julia'} 迭代 ${state.mb.iter}`;
        $('info').textContent = `FPS ${Math.round(fps)} · ${extra}`;
    }

    function syncInfo() {
        const label = {
            sierpinski: '谢尔宾斯基垫片', ngon: 'n 边形混沌',
            tetra: '四面体垫片 (3D)', mandelbrot: 'Mandelbrot / Julia'
        }[state.fractalType];
        const l = document.querySelector('#typeLabel'); if (l) l.textContent = label;
        const a = document.querySelector('#animStatus'); if (a) a.textContent = state.anim.playing ? '生长中' : '已暂停';
    }

    // ---------- 启动 ----------
    window.addEventListener('resize', resize);
    resetView();
    rebuildChaos();
    rebuildRec2D();
    rebuildTetra();
    panel.setActiveMode(state.renderMode);
    refreshGroups();
    syncInfo();
    requestAnimationFrame(frame);
})();

/**
 * fractals.js — 几何模块：纯数据生成，不依赖 GL / UI。
 * 包含两类核心算法：
 *   1) 混沌游戏（Chaos Game）：随机迭代逼近分形垫片；
 *   2) 递归细分（subdivide）：对三角形/四面体逐层细分生成垫片。
 * 扩展：任意 n 边形混沌、3D 四面体垫片。
 * 所有函数返回纯 JS 数组 / TypedArray，颜色由 palettes.js 另行计算。
 */
'use strict';
(function () {
    // 谢尔宾斯基三角的三个顶点（质心位于原点）
    const TRI = [
        [-0.5, -0.2886751345948129],
        [0.5, -0.2886751345948129],
        [0, 0.5773502691896257]
    ];

    /** 生成以原点为中心、半径为 radius 的正 n 边形顶点。 */
    function regularPolygon(n, radius = 1.0) {
        const verts = [];
        for (let i = 0; i < n; i++) {
            const a = (2 * Math.PI * i) / n - Math.PI / 2;
            verts.push([radius * Math.cos(a), radius * Math.sin(a)]);
        }
        return verts;
    }

    /**
     * 混沌游戏：p ← (p + 随机顶点) * ratio，迭代 numPoints 次。
     * @param {number[][]} polygon 多边形顶点（[[x,y],...]）
     * @param {number} numPoints 生成点数（≥1）
     * @param {number} ratio 收缩比（三角取 0.5）
     * @returns {{positions: Float32Array, source: Uint8Array}}
     *          positions 为 x,y 交错；source 为每点映射到的顶点下标（供配色用）
     */
    function chaosGame(polygon, numPoints, ratio) {
        const n = polygon.length;
        const positions = new Float32Array(numPoints * 2);
        const source = new Uint8Array(numPoints);
        // 随机初始点（任意位置均可，迭代会收敛到吸引子）
        let x = Math.random() - 0.5;
        let y = Math.random() - 0.5;
        for (let i = 0; i < numPoints; i++) {
            const v = polygon[(Math.random() * n) | 0];
            x = (x + v[0]) * ratio;
            y = (y + v[1]) * ratio;
            positions[i * 2] = x;
            positions[i * 2 + 1] = y;
            source[i] = /* 记录来源顶点，仅为可选配色用 */ 0;
        }
        // 回填来源顶点索引（供“按顶点分区”配色方案使用）
        for (let i = 0; i < numPoints; i++) {
            source[i] = 0; // 由下方重写
        }
        // 重新生成并记录来源，保证配色信息与位置一一对应
        x = Math.random() - 0.5; y = Math.random() - 0.5;
        for (let i = 0; i < numPoints; i++) {
            const vi = (Math.random() * n) | 0;
            const v = polygon[vi];
            x = (x + v[0]) * ratio;
            y = (y + v[1]) * ratio;
            positions[i * 2] = x;
            positions[i * 2 + 1] = y;
            source[i] = vi;
        }
        return { positions, source };
    }

    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    /**
     * 递归细分三角形：对每个三角形取三边中点，挖去中心小三角，保留 3 个角三角形。
     * 采用迭代实现，避免深度过大时递归爆栈。
     * @param {number[][]} triangle 三角形三个顶点
     * @param {number} depth 细分深度（0 = 不细分）
     * @returns {number[][][]} 三角形列表
     */
    function subdivideTriangle(triangle, depth) {
        let tris = [triangle];
        for (let d = 0; d < depth; d++) {
            const next = [];
            for (const t of tris) {
                const [a, b, c] = t;
                const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
                next.push([a, ab, ca], [ab, b, bc], [ca, bc, c]);
            }
            tris = next;
        }
        return tris;
    }

    /**
     * 把细分后的三角形列表整理为索引化顶点数据（去重，供点/线/面三种模式复用）。
     * @param {number[][][]} triangles
     * @returns {{vertices: Float32Array, tri: Uint32Array, line: Uint32Array, point: Uint32Array}}
     */
    function gasketIndexed(triangles) {
        // 顶点去重
        const map = new Map();          // "x,y" -> 顶点下标
        const verts = [];               // [x,y] 列表
        const keyOf = (p) => p[0].toFixed(6) + ',' + p[1].toFixed(6);
        const addV = (p) => {
            const k = keyOf(p);
            let id = map.get(k);
            if (id === undefined) { id = verts.length; map.set(k, id); verts.push(p[0], p[1]); }
            return id;
        };
        const tri = [];
        for (const t of triangles) {
            const ia = addV(t[0]), ib = addV(t[1]), ic = addV(t[2]);
            tri.push(ia, ib, ic);
        }
        // 线框：每条边去重
        const line = [];
        const edgeSet = new Set();
        for (const t of triangles) {
            const ia = addV(t[0]), ib = addV(t[1]), ic = addV(t[2]);
            const pushEdge = (a, b) => {
                const k = a < b ? a + ',' + b : b + ',' + a;
                if (!edgeSet.has(k)) { edgeSet.add(k); line.push(a, b); }
            };
            pushEdge(ia, ib); pushEdge(ib, ic); pushEdge(ic, ia);
        }
        const point = Array.from({ length: verts.length / 2 }, (_, i) => i);
        return {
            vertices: new Float32Array(verts),
            tri: new Uint32Array(tri),
            line: new Uint32Array(line),
            point: new Uint32Array(point)
        };
    }

    // ---- 3D 四面体垫片（扩展 E3）----
    /** 单位正四面体的 4 个顶点（含颜色）。 */
    function makeTetrahedron() {
        // 顶点：上顶点 + 底面等边三角形三点（坐标与教材四面体一致，单位边长）
        const a = [0, 0, 1];
        const b = [0, 0.9428090415820635, -0.3333333333333333];
        const c = [-0.816496580927726, -0.4714045207910317, -0.3333333333333333];
        const d = [0.816496580927726, -0.4714045207910317, -0.3333333333333333];
        return [
            { pos: a, color: [1, 0.2, 0.2] },
            { pos: b, color: [0.2, 1, 0.2] },
            { pos: c, color: [0.2, 0.4, 1] },
            { pos: d, color: [1, 1, 0.2] }
        ];
    }

    /**
     * 递归细分四面体：每个四面体保留 4 个角上的小四面体（挖去中心的八面体）。
     * 新顶点（边中点）的位置与颜色均取两端平均，从而在渲染时获得平滑的颜色渐变。
     * @param {{pos:number[],color:number[]}[]} tetra 4 个顶点
     * @param {number} depth 细分深度
     * @returns {{pos:number[],color:number[]}[][]} 四面体列表
     */
    function subdivideTetra(tetra, depth) {
        let tetras = [tetra];
        for (let d = 0; d < depth; d++) {
            const next = [];
            for (const t of tetras) {
                const [a, b, c, d4] = t;
                const m = (p, q) => ({
                    pos: [(p.pos[0] + q.pos[0]) / 2, (p.pos[1] + q.pos[1]) / 2, (p.pos[2] + q.pos[2]) / 2],
                    color: [(p.color[0] + q.color[0]) / 2, (p.color[1] + q.color[1]) / 2, (p.color[2] + q.color[2]) / 2]
                });
                const ab = m(a, b), ac = m(a, c), ad = m(a, d4);
                const bc = m(b, c), bd = m(b, d4), cd = m(c, d4);
                next.push([a, ab, ac, ad]);
                next.push([ab, b, bc, bd]);
                next.push([ac, bc, c, cd]);
                next.push([ad, bd, cd, d4]);
            }
            tetras = next;
        }
        return tetras;
    }

    /**
     * 把四面体列表整理为渲染用的交错顶点数组 + 图元选择。
     * @param {{pos,color}[][]} tetras
     * @param {'solid'|'lines'|'points'} mode
     * @returns {{vertexData: Float32Array, count: number, primitive: number}}
     */
    function tetraRenderData(tetras, mode) {
        const data = [];
        const push = (v) => data.push(v.pos[0], v.pos[1], v.pos[2], v.color[0], v.color[1], v.color[2]);
        let primitive;
        if (mode === 'solid') {
            primitive = 4; // TRIANGLES
            for (const t of tetras) {
                const [a, b, c, d] = t;
                // 四面体的四个面，法线向内朝原点，保证剔除后可见
                push(a); push(b); push(c);
                push(a); push(c); push(d);
                push(a); push(d); push(b);
                push(b); push(d); push(c);
            }
        } else if (mode === 'lines') {
            primitive = 1; // LINES
            for (const t of tetras) {
                const [a, b, c, d] = t;
                const edges = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]];
                for (const [p, q] of edges) { push(p); push(q); }
            }
        } else {
            primitive = 0; // POINTS
            for (const t of tetras) for (const v of t) push(v);
        }
        return { vertexData: new Float32Array(data), count: data.length / 6, primitive };
    }

    window.FractalGeometry = {
        TRI,
        regularPolygon,
        chaosGame,
        subdivideTriangle,
        gasketIndexed,
        makeTetrahedron,
        subdivideTetra,
        tetraRenderData
    };
})();

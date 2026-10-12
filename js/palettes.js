/**
 * palettes.js — 配色方案模块。
 * 提供 ≥ 4 套配色，并按位置 / 来源顶点给顶点上色。
 * 独立于 GL 与 UI，颜色以 0..1 的 RGB 三元组输出。
 */
'use strict';
(function () {
    /** 配色方案清单（UI 下拉框据此生成）。 */
    const schemes = [
        { id: 'mono', label: '单色', desc: '经典单一颜色' },
        { id: 'tricolor', label: '按顶点分区', desc: '按映射顶点分色（仅混沌/四面体）' },
        { id: 'gradient', label: '位置渐变', desc: '沿 x/y 位置平滑渐变' },
        { id: 'heat', label: '热力图', desc: '基于到中心的距离' },
        { id: 'neon', label: '霓虹', desc: '高饱和对比配色' }
    ];

    function hslToRgb(h, s, l) {
        h = ((h % 1) + 1) % 1;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 1 / 6) { r = c; g = x; }
        else if (h < 2 / 6) { r = x; g = c; }
        else if (h < 3 / 6) { g = c; b = x; }
        else if (h < 4 / 6) { g = x; b = c; }
        else if (h < 5 / 6) { r = x; b = c; }
        else { r = c; b = x; }
        return [r + m, g + m, b + m];
    }

    /** 对一组 2D 点按位置上色。positions: Float32Array(x,y,...)，返回 RGB Float32Array。 */
    function colorizePositions(positions, schemeId) {
        const n = positions.length / 2;
        const colors = new Float32Array(n * 3);
        let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
        for (let i = 0; i < n; i++) {
            loX = Math.min(loX, positions[i * 2]);
            hiX = Math.max(hiX, positions[i * 2]);
            loY = Math.min(loY, positions[i * 2 + 1]);
            hiY = Math.max(hiY, positions[i * 2 + 1]);
        }
        const spanX = hiX - loX || 1;
        const spanY = hiY - loY || 1;
        for (let i = 0; i < n; i++) {
            const x = (positions[i * 2] - loX) / spanX;
            const y = (positions[i * 2 + 1] - loY) / spanY;
            const dist = Math.min(1, Math.sqrt(Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2)) * 2.1);
            let c;
            switch (schemeId) {
                case 'mono': c = [0.95, 0.55, 0.15]; break;
                case 'gradient': c = hslToRgb(0.6 * x + 0.1, 0.9, 0.35 + 0.5 * y); break;
                case 'heat': c = hslToRgb(0.65 * (1 - dist), 1, 0.3 + 0.5 * dist); break;
                case 'neon': c = hslToRgb(0.5 + 0.5 * x, 1, 0.45 + 0.2 * y); break;
                default: c = [0.9, 0.4, 0.2];
            }
            colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
        }
        return colors;
    }

    /**
     * 对混沌游戏点按来源顶点上色（支持“按顶点分区”）。
     * positions: x,y 交错；source: Uint8Array 每点来源顶点。
     */
    function colorizeChaos(positions, source, schemeId) {
        const n = positions.length / 2;
        const colors = new Float32Array(n * 3);
        if (schemeId === 'tricolor') {
            const maxSrc = source.length ? Math.max(...source) + 1 : 1;
            for (let i = 0; i < n; i++) {
                const c = hslToRgb(source[i] / maxSrc, 0.85, 0.5);
                colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
            }
            return colors;
        }
        // 其余方案退化为按位置上色
        return colorizePositions(positions, schemeId);
    }

    window.Palettes = { schemes, colorizePositions, colorizeChaos, hslToRgb };
})();

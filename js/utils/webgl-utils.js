/**
 * webgl-utils.js — 自包含的 WebGL 辅助工具（对应教材配套 Common/webgl-utils.js 的 API）。
 * 独立实现，仅保留本项目需要的最小能力：WebGL2 上下文获取、着色器编译。
 * 'use strict';
 */
(function () {
    'use strict';

    /**
     * 获取 WebGL2 渲染上下文。若浏览器不支持 WebGL2 则在 canvas 上给出提示。
     * @param {HTMLCanvasElement} canvas
     * @returns {WebGL2RenderingContext}
     */
    function setupWebGL(canvas) {
        const gl = canvas.getContext('webgl2');
        if (!gl) {
            canvas.getContext('2d');
            const ctx = canvas.getContext('2d');
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('您的浏览器不支持 WebGL2（请使用新版 Chrome / Edge / Firefox）',
                canvas.width / 2, canvas.height / 2);
            throw new Error('WebGL2 is not supported in this browser.');
        }
        return gl;
    }

    /**
     * 把元素索引 / 长度等包装成便于渲染的常量，避免各处魔法数字。
     * 保持与教材同名工具一致的风格。
     */
    const PRIMITIVES = {
        POINTS: 0,
        LINES: 1,
        LINE_LOOP: 2,
        LINE_STRIP: 3,
        TRIANGLES: 4,
        TRIANGLE_STRIP: 5,
        TRIANGLE_FAN: 6
    };

    // 导出到全局（本工程不使用模块打包，采用 IIFE + 全局命名空间）。
    window.webglUtils = { setupWebGL: setupWebGL, PRIMITIVES: PRIMITIVES };
})();

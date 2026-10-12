/**
 * initShaders.js — 自包含的着色器编译/链接工具，对应教材配套 Common/initShaders.js 的 API。
 * 与教材同名函数行为一致：initShaders(gl, vshaderSource, fshaderSource) 返回可用的着色器程序。
 * 完全支持 WebGL2（#version 300 es）。
 */
'use strict';
(function () {
    function getShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('着色器编译失败: ' + log);
        }
        return shader;
    }

    /**
     * 编译并链接顶点/片元着色器，返回 program。
     * @param {WebGL2RenderingContext} gl
     * @param {string} vSource 顶点着色器源码
     * @param {string} fSource 片元着色器源码
     * @returns {WebGLProgram}
     */
    function initShaders(gl, vSource, fSource) {
        const vs = getShader(gl, gl.VERTEX_SHADER, vSource);
        const fs = getShader(gl, gl.FRAGMENT_SHADER, fSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error('着色器程序链接失败: ' + log);
        }
        gl.useProgram(program);
        return program;
    }

    window.initShaders = initShaders;
})();

/**
 * mandelbrot.js — Mandelbrot / Julia 集探索器渲染器（扩展 E2）。
 * 用全屏四边形 + 片元着色器逐像素计算逃逸时间，支持平移、缩放、配色映射与迭代次数调整。
 */
'use strict';
(function () {
    const VERT_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

    const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec2 uCenter;   // 视口中心（复平面）
uniform float uScale;   // 视口半宽（复平面）
uniform float uAspect;  // 画布宽/高
uniform int  uIter;     // 最大迭代次数
uniform int  uMode;     // 0=Mandelbrot, 1=Julia
uniform vec2 uC;        // Julia 常数
uniform int  uPalette;  // 配色
out vec4 fragColor;
void main(){
    vec2 uv = vUV;
    uv.x /= uAspect;                 // 修正非方形画布造成的拉伸
    vec2 z = (uMode == 0) ? vec2(0.0) : uCenter + uv * uScale;
    vec2 c = (uMode == 0) ? uCenter + uv * uScale : uC;
    int i = 0;
    float r2 = 0.0;
    for (i = 0; i < uIter; i++) {
        z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
        r2 = dot(z, z);
        if (r2 > 4.0) break;
    }
    if (i == uIter) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    // 平滑着色（连续逃逸时间）
    float nu = float(i) + 1.0 - log2(log2(max(r2, 4.0)) / 2.0);
    float t = nu / float(uIter);
    vec3 col;
    if (uPalette == 0) {           // 经典
        col = 0.5 + 0.5 * cos(6.28318 * (t * 3.0 + vec3(0.0, 0.33, 0.67)));
    } else if (uPalette == 1) {    // 暖色
        col = vec3(t, t*t, t*t*t) + vec3(0.2, 0.1, 0.05);
    } else {                        // 冷色蓝
        col = vec3(0.05 + 0.8*t, 0.1 + 0.7*t, 0.5 + 0.5*t);
    }
    fragColor = vec4(col, 1.0);
}`;

    class MandelbrotRenderer {
        constructor(gl) {
            this.gl = gl;
            this.program = initShaders(gl, VERT_SRC, FRAG_SRC);
            this.loc = {
                aPos: gl.getAttribLocation(this.program, 'aPos'),
                uCenter: gl.getUniformLocation(this.program, 'uCenter'),
                uScale: gl.getUniformLocation(this.program, 'uScale'),
                uAspect: gl.getUniformLocation(this.program, 'uAspect'),
                uIter: gl.getUniformLocation(this.program, 'uIter'),
                uMode: gl.getUniformLocation(this.program, 'uMode'),
                uC: gl.getUniformLocation(this.program, 'uC'),
                uPalette: gl.getUniformLocation(this.program, 'uPalette')
            };
            this.buf = gl.createBuffer();
            // 全屏四边形（两个三角形）
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
            gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                gl.STATIC_DRAW);
        }

        draw(params) {
            const gl = this.gl, L = this.loc;
            gl.useProgram(this.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
            gl.enableVertexAttribArray(L.aPos);
            gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(L.uCenter, params.centerX, params.centerY);
            gl.uniform1f(L.uScale, params.scale);
            gl.uniform1f(L.uAspect, params.aspect);
            gl.uniform1i(L.uIter, params.iter);
            gl.uniform1i(L.uMode, params.mode);
            gl.uniform2f(L.uC, params.cx, params.cy);
            gl.uniform1i(L.uPalette, params.palette);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }

    window.MandelbrotRenderer = MandelbrotRenderer;
})();

/**
 * gasket2d.js — 2D 谢尔宾斯基垫片渲染器（点云 / 线框 / 实体）。
 * 一个顶点缓冲 + 一个颜色缓冲 + 可选索引缓冲，支持两种绘制路径：
 *   - drawArrays（混沌游戏点云，支持逐点生长动画，绘制前缀 count 个点）
 *   - drawElements（递归细分，点/线/面三种模式复用同一份顶点）
 * 视图变换：平移 uPan + 缩放 uZoom + 宽高比修正，全部在顶点着色器中完成。
 */
'use strict';
(function () {
    const VERT_SRC = `#version 300 es
in vec2 aPos;
in vec3 aColor;
uniform vec2 uPan;      // 平移（世界单位）
uniform float uZoom;    // 缩放
uniform float uAspect;  // 画布宽/高
uniform float uPointSize;
out vec3 vColor;
void main(){
    vec2 p = aPos * uZoom + uPan;
    p.x /= uAspect;              // 修正非方形画布造成的横向拉伸
    gl_Position = vec4(p, 0.0, 1.0);
    vColor = aColor;
    gl_PointSize = uPointSize;
}`;
    const FRAG_SRC = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main(){ fragColor = vec4(vColor, 1.0); }`;

    class Gasket2DRenderer {
        constructor(gl) {
            this.gl = gl;
            this.program = initShaders(gl, VERT_SRC, FRAG_SRC);
            this.loc = {
                aPos: gl.getAttribLocation(this.program, 'aPos'),
                aColor: gl.getAttribLocation(this.program, 'aColor'),
                uPan: gl.getUniformLocation(this.program, 'uPan'),
                uZoom: gl.getUniformLocation(this.program, 'uZoom'),
                uAspect: gl.getUniformLocation(this.program, 'uAspect'),
                uPointSize: gl.getUniformLocation(this.program, 'uPointSize')
            };
            this.posBuf = gl.createBuffer();
            this.colorBuf = gl.createBuffer();
            this.indexBuf = gl.createBuffer();
            this.indexCount = 0;
            this.vertexCount = 0;
        }

        /**
         * 上传顶点 / 颜色数据（索引另行通过 useIndices 设置）。
         * @param {Float32Array} positions x,y 交错
         * @param {Float32Array} colors   r,g,b 交错
         */
        setData(positions, colors) {
            const gl = this.gl;
            this.vertexCount = positions.length / 2;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
            gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        }

        /** 设置当前绘制的索引缓冲（点/线/面三套索引切换用）。 */
        useIndices(indices) {
            const gl = this.gl;
            this.indexCount = indices ? indices.length : 0;
            if (indices) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
            }
        }

        _bind(camera, pointSize, aspect) {
            const gl = this.gl, L = this.loc;
            gl.useProgram(this.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
            gl.enableVertexAttribArray(L.aPos);
            gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
            gl.enableVertexAttribArray(L.aColor);
            gl.vertexAttribPointer(L.aColor, 3, gl.FLOAT, false, 0, 0);
            gl.uniform2f(L.uPan, camera.panX, camera.panY);
            gl.uniform1f(L.uZoom, camera.zoom);
            gl.uniform1f(L.uAspect, aspect);
            gl.uniform1f(L.uPointSize, pointSize);
        }

        /** 混沌游戏点云：按数组绘制前缀 count 个点（支持生长动画）。 */
        drawArrays(count, camera, pointSize, aspect) {
            const gl = this.gl;
            this._bind(camera, pointSize, aspect);
            gl.drawArrays(gl.POINTS, 0, count);
        }

        /** 递归细分：按索引绘制。mode: 'points'|'lines'|'triangles'。 */
        drawIndexed(mode, camera, pointSize, aspect) {
            const gl = this.gl;
            const prim = mode === 'lines' ? gl.LINES : mode === 'triangles' ? gl.TRIANGLES : gl.POINTS;
            this._bind(camera, pointSize, aspect);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);
            gl.drawElements(prim, this.indexCount, gl.UNSIGNED_INT, 0);
        }
    }

    window.Gasket2DRenderer = Gasket2DRenderer;
})();

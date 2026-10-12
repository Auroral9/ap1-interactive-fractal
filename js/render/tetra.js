/**
 * tetra.js — 3D 四面体垫片渲染器（扩展 E3）。
 * 交错顶点（x,y,z,r,g,b），可绘制实体（TRIANGLES）/ 线框（LINES）/ 点（POINTS）。
 * MVP 矩阵在 CPU 端计算（MV.js），支持自动旋转与鼠标拖动旋转。
 */
'use strict';
(function () {
    const VERT_SRC = `#version 300 es
in vec3 aPos;
in vec3 aColor;
uniform mat4 uMVP;
uniform float uPointSize;
out vec3 vColor;
void main(){
    gl_Position = uMVP * vec4(aPos, 1.0);
    vColor = aColor;
    gl_PointSize = uPointSize;
}`;
    const FRAG_SRC = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main(){ fragColor = vec4(vColor, 1.0); }`;

    class TetraRenderer {
        constructor(gl) {
            this.gl = gl;
            this.program = initShaders(gl, VERT_SRC, FRAG_SRC);
            this.loc = {
                aPos: gl.getAttribLocation(this.program, 'aPos'),
                aColor: gl.getAttribLocation(this.program, 'aColor'),
                uMVP: gl.getUniformLocation(this.program, 'uMVP'),
                uPointSize: gl.getUniformLocation(this.program, 'uPointSize')
            };
            this.buf = gl.createBuffer();
            this.count = 0;
            this.primitive = gl.TRIANGLES;
        }

        /**
         * 上传渲染数据。
         * @param {{vertexData:Float32Array, count:number, primitive:number}} data
         *        tetraRenderData() 的输出，顶点为 x,y,z,r,g,b 交错。
         */
        setData(data) {
            const gl = this.gl;
            this.count = data.count;
            this.primitive = data.primitive;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
            gl.bufferData(gl.ARRAY_BUFFER, data.vertexData, gl.STATIC_DRAW);
        }

        /** 绘制。mvp 为 Float32Array(16)。 */
        draw(mvp, pointSize) {
            const gl = this.gl, L = this.loc;
            gl.useProgram(this.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
            const stride = 6 * 4;
            gl.enableVertexAttribArray(L.aPos);
            gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(L.aColor);
            gl.vertexAttribPointer(L.aColor, 3, gl.FLOAT, false, stride, 12);
            gl.uniformMatrix4fv(L.uMVP, false, mvp);
            gl.uniform1f(L.uPointSize, pointSize);
            gl.drawArrays(this.primitive, 0, this.count);
        }
    }

    window.TetraRenderer = TetraRenderer;
})();

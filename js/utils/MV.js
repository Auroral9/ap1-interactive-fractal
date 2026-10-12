/**
 * MV.js — 自包含的向量 / 矩阵工具，对应教材配套 Common/MV.js 的 API 子集。
 * 独立实现，仅包含本项目所需的函数：
 *   flatten, mat4, mult, translate, scale, rotateX/Y/Z, perspective, lookAt
 * 全部采用 WebGL 的列主序（column-major）约定。
 */
'use strict';
(function () {
    /** 把嵌套数组 / 数组展平为一维 Float32 数组（对应教材 flatten）。 */
    function flatten(v) {
        if (Array.isArray(v)) {
            const out = [];
            (function walk(x) {
                if (Array.isArray(x)) {
                    for (let i = 0; i < x.length; i++) walk(x[i]);
                } else {
                    out.push(Number(x));
                }
            })(v);
            return out;
        }
        return [Number(v)];
    }

    /** 4x4 单位矩阵（列主序，Float32Array(16)）。 */
    function mat4() {
        const m = new Float32Array(16);
        m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
        return m;
    }

    /** 矩阵乘法 r = a * b（列主序）。组合时后调用的先作用，即 r = a·b 表示先 b 后 a。 */
    function mult(a, b) {
        const r = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let row = 0; row < 4; row++) {
                r[c * 4 + row] =
                    a[row] * b[c * 4] +
                    a[4 + row] * b[c * 4 + 1] +
                    a[8 + row] * b[c * 4 + 2] +
                    a[12 + row] * b[c * 4 + 3];
            }
        }
        return r;
    }

    /** 平移矩阵。 */
    function translate(tx, ty, tz) {
        const m = mat4();
        m[12] = tx; m[13] = ty; m[14] = tz;
        return m;
    }

    /** 缩放矩阵。 */
    function scale(sx, sy, sz) {
        const m = mat4();
        m[0] = sx; m[5] = sy; m[10] = sz;
        return m;
    }

    function rotateX(theta) {
        const c = Math.cos(theta), s = Math.sin(theta);
        const m = mat4();
        m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
        return m;
    }
    function rotateY(theta) {
        const c = Math.cos(theta), s = Math.sin(theta);
        const m = mat4();
        m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
        return m;
    }
    function rotateZ(theta) {
        const c = Math.cos(theta), s = Math.sin(theta);
        const m = mat4();
        m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
        return m;
    }

    /** 透视投影矩阵（fovy 弧度，aspect=宽/高）。 */
    function perspective(fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        const m = new Float32Array(16);
        m[0] = f / aspect;
        m[5] = f;
        m[10] = (far + near) / (near - far);
        m[11] = -1;
        m[14] = (2 * far * near) / (near - far);
        return m;
    }

    /** 观察矩阵 lookAt(eye, at, up)，列主序（gluLookAt 转置形式）。
     *  前三列为 s / u / -f 基向量（行3 为 0），第四列为平移。相机朝 -z 方向。 */
    function lookAt(eye, at, up) {
        const f = norm(sub(at, eye));          // 前向（from eye to at）
        const s = norm(cross(f, up));          // 右向
        const u = cross(s, f);                 // 上向
        const m = new Float32Array(16);
        m[0] = s[0]; m[1] = u[0]; m[2] = -f[0]; m[3] = 0;
        m[4] = s[1]; m[5] = u[1]; m[6] = -f[1]; m[7] = 0;
        m[8] = s[2]; m[9] = u[2]; m[10] = -f[2]; m[11] = 0;
        m[12] = -dot(s, eye); m[13] = -dot(u, eye); m[14] = dot(f, eye); m[15] = 1;
        return m;
    }

    // ---- 3D 向量基础 ----
    function norm(v) {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
        return [v[0] / len, v[1] / len, v[2] / len];
    }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    window.MV = {
        flatten, mat4, mult, translate, scale,
        rotateX, rotateY, rotateZ, perspective, lookAt
    };
})();

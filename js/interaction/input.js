/**
 * input.js — 交互模块：鼠标（左键拖动平移 / 滚轮缩放 / 3D 旋转）与键盘（模式/动画）。
 * 只负责把原始 DOM 事件归一化为「无单位」增量与坐标，交给上层决定语义，
 * 因此不依赖具体视图实现，便于复用与测试。
 */
'use strict';
(function () {
    class InputController {
        /**
         * @param {HTMLCanvasElement} canvas
         * @param {object} handlers
         *   drag(dxClip, dyClip)   左键拖动（裁剪空间增量）
         *   zoom(factor, cx, cy)   滚轮缩放（factor>1 放大；cx,cy 为光标在裁剪空间坐标）
         *   key(code)              键盘（code 为 KeyboardEvent.code）
         */
        constructor(canvas, handlers) {
            this.canvas = canvas;
            this.h = handlers;
            this._drag = false;
            this._last = { x: 0, y: 0 };

            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) {                 // 仅左键
                    this._drag = true;
                    this._last = { x: e.clientX, y: e.clientY };
                    e.preventDefault();
                }
            });
            window.addEventListener('mousemove', (e) => {
                if (!this._drag) return;
                const r = this._toClip(e.clientX, e.clientY);
                const l = this._toClip(this._last.x, this._last.y);
                this.h.drag(r.x - l.x, r.y - l.y);
                this._last = { x: e.clientX, y: e.clientY };
            });
            window.addEventListener('mouseup', () => { this._drag = false; });
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const r = this._toClip(e.clientX, e.clientY);
                const factor = Math.exp(-e.deltaY * 0.0012);
                this.h.zoom(factor, r.x, r.y);
            }, { passive: false });

            window.addEventListener('keydown', (e) => {
                this.h.key(e.code, e);
            });
        }

        /** 把屏幕像素坐标换算为画布内的裁剪空间坐标（x,y ∈ [-1,1]）。 */
        _toClip(px, py) {
            const rect = this.canvas.getBoundingClientRect();
            const cx = ((px - rect.left) / rect.width) * 2 - 1;
            const cy = 1 - ((py - rect.top) / rect.height) * 2;
            return { x: cx, y: cy };
        }
    }

    window.InputController = InputController;
})();

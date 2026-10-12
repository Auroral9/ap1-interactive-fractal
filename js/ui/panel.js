/**
 * panel.js — 参数面板模块：负责把 index.html 中的 HTML 控件与状态变更回调绑定。
 * 控件统一使用 data-key 标注；输入/变更事件被归一化为 onChange(key, value)。
 * 按钮类（渲染模式 / 动画开关）单独处理高亮与互斥。
 */
'use strict';
(function () {
    class ControlPanel {
        /**
         * @param {HTMLElement} root  面板根节点
         * @param {Function} onChange  (key, value) => void
         */
        constructor(root, onChange) {
            this.root = root;
            this.onChange = onChange;

            // 通用控件：带 data-key 的 input/select
            this.root.querySelectorAll('[data-key]').forEach((el) => {
                const key = el.getAttribute('data-key');
                const fire = () => {
                    onChange(key, this._value(el));
                };
                el.addEventListener('input', fire);
                el.addEventListener('change', fire);
            });
            // 初始化数值标签（不触发 onChange，避免构造期回调依赖未就绪对象）
            this.root.querySelectorAll('[data-key][data-label]').forEach((el) => {
                const lb = this.root.querySelector('#' + el.getAttribute('data-label'));
                if (lb) lb.textContent = el.valueAsNumber;
            });

            // 渲染模式按钮（互斥）
            this.modeBtns = Array.from(this.root.querySelectorAll('.mode-btn'));
            this.modeBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    this.setActiveMode(btn.getAttribute('data-mode'));
                    onChange('renderMode', btn.getAttribute('data-mode'));
                });
            });

            // 动画开关按钮
            this.animBtn = this.root.querySelector('#animToggle');
            if (this.animBtn) {
                this.animBtn.addEventListener('click', () => onChange('toggleAnim', null));
            }
        }

        _value(el) {
            if (el.type === 'checkbox') return el.checked;
            if (el.type === 'range' || el.type === 'number') return el.valueAsNumber;
            return el.value;
        }

        /** 高亮某个渲染模式按钮。 */
        setActiveMode(mode) {
            this.modeBtns.forEach((b) => {
                b.classList.toggle('active', b.getAttribute('data-mode') === mode);
            });
        }

        /** 收集面板当前所有 data-key 控件的值。 */
        readAll() {
            const out = {};
            this.root.querySelectorAll('[data-key]').forEach((el) => {
                out[el.getAttribute('data-key')] = this._value(el);
            });
            return out;
        }

        /** 同步显示某个 range 的数值标签。 */
        setRangeLabel(id, text) {
            const el = this.root.querySelector('#' + id);
            if (el) el.textContent = text;
        }

        /**
         * 依据当前分形类型，显示/隐藏对应的参数分组。
         * @param {object} groups {points, depth, ngon, mandelbrot, anim:boolean}
         */
        applyGroups(groups) {
            const names = ['points', 'depth', 'ngon', 'mandelbrot'];
            names.forEach((n) => {
                const g = this.root.querySelector('[data-group="' + n + '"]');
                if (g) g.style.display = (groups[n] ? '' : 'none');
            });
            const anim = this.root.querySelector('[data-group="anim"]');
            if (anim) anim.style.display = (groups.anim === false ? 'none' : '');
        }
    }

    window.ControlPanel = ControlPanel;
})();

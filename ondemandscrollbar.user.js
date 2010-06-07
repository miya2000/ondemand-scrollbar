// ==UserScript==
// @name      ondemand scrollbar
// @namespace http://www.hatena.ne.jp/miya2000/scrollbar/
// @version   2.00 Beta
// @include   *
// ==/UserScript==
(function(f) {
    //for debug.
    return function() {
        var s = document.createElement('script');
        s.setAttribute('type', 'text/javascript');
        s.setAttribute('style', 'display: none;');
        s.textContent = '(' + f.toString() + ')()';
        (document.body || document.documentElement).appendChild(s);
    };
})
(function() {
    
    var SCROLLBAR_NAMESPACE = 'http://www.hatena.ne.jp/miya2000/scrollbar/';
    var Browser = {
        Opera: !!window.opera,
        Opera_version: window.opera ? parseFloat(window.opera.version()) : null,
        Webkit: (navigator.userAgent.indexOf(' AppleWebKit/') >= 0)
    };
    
    /// class Smooth - simple smooth animation.
    function Smooth(target, property, baseDuration, delay, initialRatio) {
        this.target = target;
        this.property = property;
        this.baseDuration = baseDuration || 180;
        this.delay = delay || 16;
        this.initialRatio = initialRatio || 0;
    }
    Smooth.easings = {
        easeNone    : function easeNone(t, b, c, d) { return c*t/d + b; },
        easeInSine  : function easeInSine(t, b, c, d)  { return -c * Math.cos(t/d *(Math.PI/2)) + c + b; },
        easeOutSine : function easeOutSine(t, b, c, d) { return  c * Math.sin(t/d *(Math.PI/2)) + b; },
        easeInExpo  : function easeInExpo(t, b, c, d)  { return(t==0) ? b : c * Math.pow(2, 10 *(t/d - 1)) + b - c * 0.001; },
        easeOutExpo : function easeOutExpo(t, b, c, d) { return(t==d) ? b+c : c * 1.001 *(-Math.pow(2, -10 * t/d) + 1) + b; }
    };
    (function(member) { member.apply(Smooth.prototype) })(function() {
        this.easing = Smooth.easings.easeOutExpo;
        this.duration = function(change, sliding) { return this.baseDuration; };
        this.go = function(/*from, */dest) {
            var target = this.target, prop = this.property, from;
            if (arguments.length > 1) {
                from = arguments[0];
                dest = arguments[1];
            }
            else {
                from = target[prop];
            }
            if (this.isActive) {
                if (this.dest == dest) return;
                this.dest = dest;
                this.activity.slide(dest);
                return;
            }
            var begin = parseFloat(from) || 0, end = parseFloat(dest), change = end - begin;
            if (this.initialRatio) begin += change * this.initialRatio;
            var m = /[0-9]*\.?([0-9]*)(.*)/.exec(dest), scale = (m ? m[1].length : 0), unit = (m ? m[2] : null);
            var power = Math.pow(10, scale);
            var start = new Date(), duration = this.duration(change, false);
            this.from = from; this.dest = dest; this.isActive = true;
            this.activity = {
                slide: slide,
                anim: anim,
                dispose: dispose
            };
            var self = this;
            function slide(dest) {
                var cur = parseFloat(self.current());
                if (!isNaN(cur)) begin = cur;
                end = parseFloat(dest);
                change = end - begin;
                start = new Date();
                duration = self.duration(change, true);
            }
            function anim() {
                var finished = false;
                try {
                    var time = new Date() - start, next;
                    if (time >= duration) {
                        next = self.dest;
                        finished = true;
                    }
                    else {
                        next = (self.easing(time, begin, change, duration) * power + 0.5 | 0) / power; // not strict round at negative value.
                        if (unit) next = next + unit;
                    }
                    target[prop] = next;
                }
                catch(e) { self.clear(); throw e; }
                if (finished) {
                    self.clear();
                    if (self.onfinish) self.onfinish();
                }
                else {
                    if (self.onprogress) self.onprogress();
                }
            }
            var tid = setInterval(anim, this.delay);
            function dispose() { if (tid) clearInterval(tid); tid = null; }
            if (arguments.length > 1 || duration <= 0) anim(); // call first if "from" set or "duration" isn't set.
        };
        this.current = function() {
            return this.target[this.property];
        };
        this.clear = function() {
            this.isActive = false;
            if (this.activity != null) this.activity.dispose();
            this.activity = null;
        };
        this.restore = function() {
            if (this.from != null) this.target[this.property] = this.from;
            this.clear();
        };
    });
    
    /// class Scrollable - scrollable element wrapper.
    function Scrollable(element) {
        if (!(this instanceof Scrollable)) return new Scrollable(element);
        this.element = element;
        this.scrollElement = Scrollable.fn.getScrollElement(element);
        this.scroller = {
            '1': new Smooth(this.scrollElement, 'scrollLeft'),
            '2': new Smooth(this.scrollElement, 'scrollTop')
        };
        this.scroller[1].easing = this.scroller[2].easing = Smooth.easings.easeOutSine;
        this.scroller[1].duration = this.scroller[2].duration = function(change, sliding) {
            var abs = (change ^ (change >> 31)) - (change >> 31); // Math.abs(change);
            if (abs < 120) return this.baseDuration * (abs / 120) | 0;
            return this.baseDuration;
        };
        if (this.isRoot() && Browser.Webkit) {
            this.scroller[1].onprogress = this.scroller[2].onprogress = function() {
                Scrollable.fn.dispatchScrollEvent(document);
            };
        }
    }
    Scrollable.HORIZONTAL_AXIS = 1; // compatible MouseScrollEvent(Gecko).
    Scrollable.VERTICAL_AXIS   = 2; 
    var Sfn = Scrollable.fn = (function() {
        //[[navico notation]]
        return {
            getRoot: getRoot,
            isRoot: isRoot,
            dispatchScrollEvent: dispatchScrollEvent,
            getClientWidth: getClientWidth,
            getClientHeight: getClientHeight,
            getScrollWidth: getScrollWidth,
            getScrollHeight: getScrollHeight,
            getScrollLeft: getScrollLeft,
            getScrollTop: getScrollTop,
            getScrollElement: getScrollElement,
            isScrollable: isScrollable,
            isScrollableNode: isScrollableNode,
            scrollDirectTo: scrollDirectTo,
            scrollDirectBy: scrollDirectBy,
            scrollTo: scrollTo,
            scrollBy: scrollBy
        };
        function getRoot() {
            return Scrollable.ROOT || (Scrollable.ROOT = (document.compatMode == 'BackCompat') ? document.body : document.documentElement);
        }
        function isRoot(ele) {
            return ele === getRoot();
        }
        function dispatchScrollEvent(target) {
            var ev = document.createEvent('HTMLEvents');
            ev.initEvent('scroll', true, false);
            target.dispatchEvent(ev);
        }
        function getClientWidth(viewElement) {
            return viewElement.clientWidth;
        }
        function getClientHeight(viewElement) {
            return viewElement.clientHeight;
        }
        function getScrollWidth(scrollElement) {
            if (Browser.Opera) {
                var style = document.defaultView.getComputedStyle(scrollElement, '');
                var pad = 0;
                if (Browser.Opera_version <= 10.10) {
                    pad -= parseInt(style.borderLeftWidth, 10);
                }
                else {
                    pad += parseInt(style.paddingLeft, 10);
                }
                return scrollElement.scrollWidth + pad;
            }
            else {
                return scrollElement.scrollWidth;
            }
        }
        function getScrollHeight(scrollElement) {
            if (Browser.Opera && !isRoot(scrollElement)) {
                var style = document.defaultView.getComputedStyle(scrollElement, '');
                var pad = 0;
                pad += parseInt(style.paddingTop, 10);
                pad -= (scrollElement.offsetHeight - scrollElement.clientHeight - parseInt(style.borderTopWidth, 10) - parseInt(style.borderBottomWidth, 10));
                return scrollElement.scrollHeight + pad;
            }
            else {
                return scrollElement.scrollHeight;
            }
        }
        function getScrollLeft(scrollElement) {
            return scrollElement.scrollLeft;
        }
        function getScrollTop(scrollElement) {
            return scrollElement.scrollTop;
        }
        function getScrollElement(ele) {
            if (isRoot(ele) && Browser.Webkit) return document.body;
            return ele;
        }
        function isScrollable(ele, h1v2orEither, u1d2orEither) {
            var scr = getScrollElement(ele);
            if (h1v2orEither == 1) {
                if (u1d2orEither == 1) return getScrollLeft(scr) > 0;
                if (u1d2orEither == 2) return getScrollLeft(scr) < getScrollWidth(scr) - getClientWidth(ele);
                return getScrollWidth(scr) > getClientWidth(ele);
            }
            if (h1v2orEither == 2) {
                if (u1d2orEither == 1) return getScrollTop(scr) > 0;
                if (u1d2orEither == 2) return getScrollTop(scr) < getScrollHeight(scr) - getClientHeight(ele);
                return getScrollHeight(scr) > getClientHeight(ele);
            }
            return (getScrollWidth(scr) > getClientWidth(ele)) || (getScrollHeight(scr) > getClientHeight(ele));
        }
        function isScrollableNode(ele, h1v2) {
            if (!ele || ele.nodeType != 1) return false;
            if (isRoot(ele)) return true;
            if (ele.nodeName == 'TEXTAREA') return true;
            var style = document.defaultView.getComputedStyle(ele, '');
            if (style.display != 'block') return false;
            if (typeof style.overflowY == 'undefined') {
                return /^(auto|scroll)$/.test(style.overflow);
            }
            else {
                if (h1v2 == 1) return /^(auto|scroll)$/.test(style.overflowX);
                if (h1v2 == 2) return /^(auto|scroll)$/.test(style.overflowY);
                return /^(auto|scroll)$/.test(style.overflow);
            }
        }
        function scrollDirectTo(ele, h1v2, to) {
            var dest = to, max, scr = getScrollElement(ele);
            if (h1v2 == 1) max = getScrollWidth(scr)  - getClientWidth(ele);
            if (h1v2 == 2) max = getScrollHeight(scr) - getClientHeight(ele);
            if (dest < 0  ) dest = 0;
            if (dest > max) dest = max;
            if (h1v2 == 1) scr.scrollLeft = dest;
            if (h1v2 == 2) scr.scrollTop  = dest;
            if (isRoot(ele) && Browser.Webkit) {
                dispatchScrollEvent(document);
            }
        }
        function scrollDirectBy(ele, h1v2, delta) {
            Sfn.scrollDirectTo(ele, h1v2, (h1v2 == 1 ? getScrollLeft(ele) : getScrollTop(ele)) + delta);
        }
        function scrollTo(ele, x, y) {
            if (x != null) Sfn.scrollDirectTo(ele, 1, x);
            if (y != null) Sfn.scrollDirectTo(ele, 2, y);
        }
        function scrollBy(ele, dx, dy) {
            if (dx != null) Sfn.scrollDirectBy(ele, 1, dx);
            if (dy != null) Sfn.scrollDirectBy(ele, 2, dy);
        }
    })();
    (function(member) { member.apply(Scrollable.prototype); })(function() {
        this.isRoot = function() { return Sfn.isRoot(this.element); };
        this.getClientWidth = function() { return Sfn.getClientWidth(this.element); };
        this.getClientHeight = function() { return Sfn.getClientHeight(this.element); };
        this.getScrollWidth = function() { return Sfn.getScrollWidth(this.scrollElement); };
        this.getScrollHeight = function() { return Sfn.getScrollHeight(this.scrollElement); };
        this.getScrollLeft = function() { return Sfn.getScrollLeft(this.scrollElement); };
        this.getScrollTop = function() { return Sfn.getScrollTop(this.scrollElement); };
        this.isScrollable = function(h1v2, u1d2) { return Sfn.isScrollable(this.element, h1v2, u1d2); };
        this.isScrollableNode = function() { return Sfn.isScrollableNode(this.element); };
        this.scrollDirectTo = function scrollDirectTo(h1v2, to, smooth) {
            if (!smooth) {
                Sfn.scrollDirectTo(this.element, h1v2, to);
                return;
            }
            var dest = to, max;
            if (h1v2 == 1) max = this.getScrollWidth()  - this.getClientWidth();
            if (h1v2 == 2) max = this.getScrollHeight() - this.getClientHeight();
            if (dest < 0  ) dest = 0;
            if (dest > max) dest = max;
            this.scroller[h1v2].go(dest);
        };
        this.scrollDirectBy = function scrollDirectBy(h1v2, delta, smooth) {
            var scroller = this.scroller[h1v2];
            var from = scroller.isActive ? scroller.dest : scroller.current();
            this.scrollDirectTo(h1v2, from + delta, smooth);
        };
        this.scrollTo = function scrollTo(x, y, smooth) {
            if (x != null) this.scrollDirectTo(1, x, smooth);
            if (y != null) this.scrollDirectTo(2, y, smooth);
        };
        this.scrollBy = function scrollTo(dx, dy, smooth) {
            if (dx != null) this.scrollDirectBy(1, dx, smooth);
            if (dy != null) this.scrollDirectBy(2, dy, smooth);
        };
    });

    var subscribe = (function() {
        // avoid global pollution.
        var w_ael = window.addEventListener;
        var w_rel = window.removeEventListener;
        function subscribe(target, type, listener, useCapture) {
            useCapture = !!useCapture;
            if (target == window) {
                w_ael.call(window, type, listener, useCapture);
                return function() { w_rel.call(window, type, listener, useCapture); };
            }
            else {
                target.addEventListener(type, listener, useCapture);
                return function() { target.removeEventListener(type, listener, useCapture); };
            }
        };
        return subscribe;
    })();
    function bind(thisobj, func/*, arg1, ...*/) {
        if (typeof func != 'function') throw new Error("invalid argument. func:" + func);
        var pre_args = [];
        pre_args.push.apply(pre_args, arguments);
        pre_args = pre_args.slice(2);
        return function() {
            var args = pre_args.concat();
            args.push.apply(args, arguments);
            return func.apply(thisobj, args);
        };
    }
    function run(/*f1, ...*/) {
        for(var i = 0, len = arguments.length; i < len; i++) {
            var f = arguments[i];
            if (f) {
                if (typeof f == 'function') f.call(this);
                else run.apply(this, f); // If f is't function, it assume f as an Array.
            }
        }
    }
    function runnable(/*f1, ...*/) {
        var args = []; args.push.apply(args, arguments);
        var self = this;
        function runnable_impl() { run.apply(self, args); };
        return runnable_impl;
    }
    function applyProperty(target, prop) {
        for (var k in prop) {
            if (prop.hasOwnProperty(k)) {
                if (k in target) target[k] = prop[k];
            }
        }
    }
    function wheelDelta(e){
        if (e.wheelDelta)  return e.wheelDelta / 120;
        else if (e.detail) return -e.detail / 3;
    }
    
    var getContextData = (function() {
        var context;
        function handler() {
            context = null;
        }
        function getContextData() {
            if (context) return context;
            setTimeout(handler, 0);
            return context = {};
        }
        return getContextData;
    })();
    
    function overridable(obj) {
        var base = function() {};
        base.prototype = obj;
        return new base;
    }

    function getAbsolutePosition(ele) {
        var rect = ele.getBoundingClientRect();
        var root = Sfn.getRoot(), scr = Sfn.getScrollElement(root);
        return {
            x: rect.left + Sfn.getScrollLeft(scr),
            y: rect.top  + Sfn.getScrollTop(scr)
        };
    }

    /// class Scrollbar - emulate scrollbar by DOM elements. 
    function Scrollbar(scrollable, direction) {
        if (direction != 1 && direction != 2) throw Error('invalid direction:' + direction);
        this.scrollable = scrollable;
        this.isRootScrollbar = this.scrollable.isRoot();
        this.direction = direction;
        this.minThumbSize = 20;
        this.space = 17;
        this.initialize();
    }
    (function(member) { member.apply(Scrollbar.prototype); })(function() {

        this.scrollbarStyle = {
            position: 'absolute', display: 'block',
            margin: '0', padding: '0', border: 'none',
            zIndex: '99998',
            boxSizing: 'border-box',
            WebkitBoxSizing: 'border-box',
            overflow: 'visible',
            backgroundColor: '#BBB'
        };
        this.verticalScrollbarStyle = {
            top: '0', right: '0',
            width: '17px', height: '100%',
            borderColor: '#BBB',
            borderStyle: 'solid',
            borderWidth: '1px 0 17px 1px'
        };
        this.horizontalScrollbarStyle = {
            bottom: '0', left: '0',
            width: '100%', height: '17px',
            borderColor: '#BBB',
            borderStyle: 'solid',
            borderWidth: '1px 17px 0 1px'
        };
        this.thumbFrameStyle = {
            position: 'static', display: 'block',
            margin: '0', padding: '0', border: 'none',
            width: '100%',
            height: '100%',
            backgroundColor: '#E9E9E9',
            borderRadius: '10px'
        };
        this.thumbStyle = {
            position: 'absolute', display: 'block',
            margin: '0', padding: '0', border: 'none',
            top: '0', left: '0',
            backgroundColor: '#D0FFD0',
            borderRadius: '10px'
        };
        this.verticalThumbStyle = {
            width: '100%', height: '40px'
        };
        this.horizontalThumbStyle = {
            width: '40px', height: '100%'
        };
        
        this.initialize = function initialize() {
            var scrollbar = document.createElement('div');
            var thumbFrame = document.createElement('div');
            var thumb = document.createElement('div');
            
            applyProperty(scrollbar.style, this.scrollbarStyle);
            applyProperty(thumbFrame.style, this.thumbFrameStyle);
            applyProperty(thumb.style, this.thumbStyle);
            if (this.direction == 1) {
                applyProperty(scrollbar.style, this.horizontalScrollbarStyle);
                applyProperty(thumb.style, this.horizontalThumbStyle);
            }
            else {
                applyProperty(scrollbar.style, this.verticalScrollbarStyle);
                applyProperty(thumb.style, this.verticalThumbStyle);
            }
            
            this.scrollbar = scrollbar;
            this.thumbFrame = thumbFrame;
            this.thumb = thumb;
            // draggable whole scrollbar box.
            subscribe(this.thumbFrame, 'mousedown', bind(this, this.ev_thumb_mousedown));
            thumbFrame.appendChild(thumb);
            scrollbar.appendChild(thumbFrame);
            
            this.position = 'BR';
            this.layoutMethod = 'absolute';
            if (this.isRootScrollbar) {
                this.setLayoutMethod('fixed');
            }
        };
        this.attach = function(container) {
            if (!container) {
                if (this.currentContainer) {
                    container = this.currentContainer;
                }
                else {
                    container = this.scrollable.isRoot() ? document.body : this.scrollable.element;
                }
            }
            container.appendChild(this.scrollbar);
            this.currentContainer = container; // keep previous container.
            this.update();
        };
        this.detach = function() {
            if (this.scrollbar.parentNode) this.scrollbar.parentNode.removeChild(this.scrollbar);
        };
        this.setLayoutMethod = function(absolute_or_fixed) {
            if (!/^(absolute|fixed)$/.test(absolute_or_fixed)) throw new Error('invalid layout method: ' + absolute_or_fixed);
            this.layoutMethod = this.scrollbar.style.position = absolute_or_fixed;
            this.setPosition();
        };
        this.setPosition = function(br_bl_tr_tl) {
            var pos = br_bl_tr_tl || this.position || 'BR'; // default: bottom horizontal, right vertical.
            pos = pos.toUpperCase();
            var sp = this.space + 'px', zp = '0', bp = '';
            var vl, vr, ht, hb, vbt, vbb, hbl, hbr;
            switch(pos) {
                case 'BR': vl = bp, vr = zp, ht = bp, hb = zp, vbt = zp, vbb = sp, hbl = zp, hbr = sp; break;
                case 'BL': vl = zp, vr = bp, ht = bp, hb = zp, vbt = zp, vbb = sp, hbl = sp, hbr = zp; break;
                case 'TR': vl = bp, vr = zp, ht = zp, hb = bp, vbt = sp, vbb = zp, hbl = zp, hbr = sp; break;
                case 'TL': vl = zp, vr = bp, ht = zp, hb = bp, vbt = sp, vbb = zp, hbl = sp, hbr = zp; break;
                default: throw new Error('invalid position: ' + pos);
            }
            if (this.direction == 1) {
                this.scrollbar.style.top = ht;
                this.scrollbar.style.left = '0';
                this.scrollbar.style.bottom = hb;
                this.scrollbar.style.borderLeftWidth = hbl;
                this.scrollbar.style.borderRightWidth = hbr;
            }
            else {
                this.scrollbar.style.top = '0';
                this.scrollbar.style.left = vl;
                this.scrollbar.style.right = vr;
                this.scrollbar.style.borderTopWidth = vbt;
                this.scrollbar.style.borderBottomWidth = vbb;
            }
            this.position = pos;
            this.update();
        };
        this.getScrollableInfo = function(e) {
            if (this.direction == 1) {
                return {
                    clientSize: this.scrollable.getClientWidth(),
                    scrollSize: this.scrollable.getScrollWidth(),
                    scrollHead: this.scrollable.getScrollLeft()
                };
            }
            else {
                return {
                    clientSize: this.scrollable.getClientHeight(),
                    scrollSize: this.scrollable.getScrollHeight(),
                    scrollHead: this.scrollable.getScrollTop()
                };
            }
        };
        this.getThumbSize = function() {
            var info = this.getScrollableInfo();
            var size = (info.clientSize - this.space) * (info.clientSize / info.scrollSize) + 0.5 | 0;
            if (size < this.minThumbSize) size = this.minThumbSize;
            return size;
        };
        this.ev_thumb_mousedown = function(e) {
            if (this.thumbDragData) this.thumbDragData.dispose();
            if (this.scrollable.isScrollable(this.direction)) {
                
                var target = e.target;
                while (target !== this.scrollbar && target !== this.thumb) { target = target.parentNode; }
                if (target !== this.thumb) {
                    var offset;
                    if (this.direction == 1) {
                        // @see http://d.hatena.ne.jp/uupaa/20100430/1272561922
                        offset = ('offsetX' in e) ? e.offsetX : e.layerX;
                        if (!Browser.Opera && this.position[1] == 'L') {
                            offset -= this.space;
                        }
                    }
                    else {
                        offset = ('offsetY' in e) ? e.offsetY : e.layerY;
                        if (!Browser.Opera && this.position[0] == 'T') {
                            offset -= this.space;
                        }
                    }
                    var info = this.getScrollableInfo(), size = this.getThumbSize(), sp = this.space;
                    var dest = (offset - size * 0.45) * (info.scrollSize / (info.clientSize - sp)) + 0.5 | 0;
                    this.scrollable.scrollDirectTo(this.direction, dest);
                }
                e.preventDefault();
                if (Browser.Opera && window.top !== window.self && this.scrollable.isRoot()) {
                    window.focus();
                }
                this.thumbDragData = {
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startScrollLeft: this.scrollable.getScrollLeft(),
                    startScrollTop: this.scrollable.getScrollTop(),
                    dispose: runnable(
                        subscribe(document, 'mousemove', bind(this, this.ev_thumb_dragging)),
                        subscribe(document, 'mouseup', bind(this, this.ev_thumb_draggend))
                    )
                };
                if (this.onStartThumbing) this.onStartThumbing();
            }
        };
        this.ev_thumb_dragging = function(e) {
            // The e.clientY value after scrolling becomes strange on Opera 10.10.
            if (Browser.Opera) {
                var context = getContextData();
                if (context.Scrollbar_thumb_dragging_session) return;
                context.Scrollbar_thumb_dragging_session = true;
            }
            var start, diff;
            if (this.direction == 1) {
                start = this.thumbDragData.startScrollLeft;
                diff = e.clientX - this.thumbDragData.startClientX;
            }
            else {
                start = this.thumbDragData.startScrollTop;
                diff = e.clientY - this.thumbDragData.startClientY;
            }
            var info = this.getScrollableInfo(), thumbSize = this.getThumbSize(), sp = this.space;
            var dest = start + (diff * ((info.scrollSize - info.clientSize) / (info.clientSize - thumbSize - sp)) + 0.5 | 0);
            this.scrollable.scrollDirectTo(this.direction, dest);
            this.update();
            if (this.onThumbing) this.onThumbing();
        }
        this.ev_thumb_draggend = function(e) {
            if (this.thumbDragData) {
                this.thumbDragData.dispose();
                this.thumbDragData = null;
            }
            if (this.onEndThumbing) this.onEndThumbing();
        }
        this.show = function show() {
            this.scrollbar.style.visibility = 'hidden';
            this.scrollbar.style.display = 'block';
            this.update();
            this.scrollbar.style.visibility = '';
        };
        this.hide = function hide() {
            this.scrollbar.style.display = 'none';
        };
        this.update = function update() {
            if (!this.scrollbar.parentNode || this.scrollbar.style.display == 'none') return;
            if (this.direction == 1) this.updateHorizontal();
            else                     this.updateVertical();
        };
        this.updateVertical = function updateVertical() {
            var scr = this.scrollable, bar = this.scrollbar, thumb = this.thumb;
            var cH = scr.getClientHeight();
            var sH = scr.getScrollHeight();
            var sL = scr.getScrollLeft();
            var sT = scr.getScrollTop();
            if (this.layoutMethod == 'absolute') {
                if (bar.style.top != sT + 'px') bar.style.top = sT + 'px';
                if (this.position[1] == 'L') if (bar.style.left  !=  sL + 'px') bar.style.left  =  sL + 'px';
                if (this.position[1] == 'R') if (bar.style.right != -sL + 'px') bar.style.right = -sL + 'px';
            }
            if (sH <= cH) {
                if (thumb.style.display != 'none') thumb.style.display = 'none';
            }
            else {
                var min = this.minThumbSize, sp = this.space;
                var head = (cH - sp) * (sT / sH) + 0.5 | 0;
                var size = (cH - sp) * (cH / sH) + 0.5 | 0;
                if (size < min) {
                    head = (cH - (min + sp)) * (sT / (sH - cH)) + 0.5 | 0;
                    size = min;
                }
                head += 'px'; size += 'px';
                if (thumb.style.top    != head) thumb.style.top    = head;
                if (thumb.style.height != size) thumb.style.height = size;
                if (thumb.style.display != '') thumb.style.display = '';
            }
        };
        this.updateHorizontal = function updateHorizontal() {
            var scr = this.scrollable, bar = this.scrollbar, thumb = this.thumb;
            var cW = scr.getClientWidth();
            var sW = scr.getScrollWidth();
            var sL = scr.getScrollLeft();
            var sT = scr.getScrollTop();
            if (this.layoutMethod == 'absolute') {
                if (bar.style.left != sL + 'px') bar.style.left = sL + 'px';
                if (this.position[0] == 'T') if (bar.style.top    !=  sT + 'px') bar.style.top    =  sT + 'px';
                if (this.position[0] == 'B') if (bar.style.bottom != -sT + 'px') bar.style.bottom = -sT + 'px';
            }
            if (sW <= cW) {
                if (thumb.style.display != 'none') thumb.style.display = 'none';
            }
            else {
                var min = this.minThumbSize, sp = this.space;
                var head = (cW - sp) * (sL / sW) + 0.5 | 0;
                var size = (cW - sp) * (cW / sW) + 0.5 | 0;
                if (size < min) {
                    head = (cW - (min + sp)) * (sL / (sW - cW)) + 0.5 | 0;
                    size = min;
                }
                head += 'px'; size += 'px';
                if (thumb.style.left  != head) thumb.style.left  = head;
                if (thumb.style.width != size) thumb.style.width = size;
                if (thumb.style.display != '') thumb.style.display = '';
            }
        };
    });
    
    /// class ScrollbarBehavior - implements scrollbar's behavior(like showing or hiding).
    function ScrollbarBehavior(scrollbars) {
        this.controller = scrollbars;
        this.scrollable = scrollbars.scrollable;
        this.scrollbars = {
            '1' : { body: scrollbars.hScrollbar, prop: {} },
            '2' : { body: scrollbars.vScrollbar, prop: {} }
        };
        this.initialize();
    }
    ScrollbarBehavior.Option = {
        opacity_positive: 0.9,
        opacity_normal: 0.7,
        opacity_negative: 0.4,
        show_onscroll: true
    };
    (function(member) { member.apply(ScrollbarBehavior.prototype); })(function() {
        this.initialize = function() {
            this.option = overridable(ScrollbarBehavior.Option);
            this.status = {};
            this.scrollbars[1].prop.opacityAnim = new Smooth(this.scrollbars[1].body.scrollbar.style, 'opacity', 800);
            this.scrollbars[2].prop.opacityAnim = new Smooth(this.scrollbars[2].body.scrollbar.style, 'opacity', 800);
            this.attachEvents();
            this.updateStatus();
            this.scrollbars[1].body.scrollbar.style.opacity = 0;
            this.scrollbars[2].body.scrollbar.style.opacity = 0;
        };
        this.attachEvents = function() {
            if (this.detachEvents) this.detachEvents();
            var detach = [];
            for (var i = 0; i < 2; i++) with({h1v2:[1,2][i]}) with({sb:this.scrollbars[h1v2].body}) {
                detach.push(
                    subscribe(sb.scrollbar, 'mousedown', bind(this, this.ev_scrollbar_mousedown, h1v2)),
                    subscribe(sb.scrollbar, 'mouseover', bind(this, this.ev_scrollbar_mouseover, h1v2)),
                    subscribe(sb.scrollbar, 'mousemove', bind(this, this.ev_scrollbar_mousemove, h1v2)),
                    subscribe(sb.scrollbar, 'mouseout', bind(this, this.ev_scrollbar_mouseout, h1v2)),
                    subscribe(sb.scrollbar, 'dblclick', bind(this, this.ev_scrollbar_dblclick, h1v2))
                );
                sb.onStartThumbing = bind(this, this.ev_thumb_startThumbing, h1v2);
                sb.onEndThumbing = bind(this, this.ev_thumb_endThumbing, h1v2);
                detach.push(function() {
                    sb.onStartThumbing = null;
                    sb.onEndThumbing = null;
                });
            }
            if (this.scrollable.isRoot()) {
                detach.push(subscribe(window, 'scroll', bind(this, this.ev_view_scroll)));
            }
            else {
                detach.push(subscribe(this.scrollable.element, 'scroll', bind(this, this.ev_view_scroll)));
            }
            this.detachEvents = function() { if (detach) run(detach); detach = null; };
        };
        this.ev_scrollbar_mousedown = function(h1v2, e) {
            this.showScrollbar(h1v2, 1300);
        };
        this.ev_scrollbar_mouseover = function(h1v2, e) {
            if (this.scrollable.isScrollable(h1v2)) {
                this.showScrollbarLater(h1v2);
            }
        };
        this.ev_scrollbar_mousemove = function(h1v2, e) {
            var sb = this.scrollbars[h1v2];
            if (sb.prop.showing) {
                this.showScrollbar(h1v2, 1300);
            }
        };
        this.ev_scrollbar_mouseout = function(h1v2, e) {
            this.hideScrollbarLater(h1v2, 650);
        };
        this.ev_scrollbar_dblclick = function(h1v2, e) {
            this.killScrollbar(h1v2);
            e.returnValue = false;
        };
        this.ev_thumb_startThumbing = function tip_mousedown(h1v2) {
            this.holdScrollbarOpacity(h1v2, this.option.opacity_positive);
        };
        this.ev_thumb_endThumbing = function tip_mousedown(h1v2) {
            this.clearHoldScrollbarOpacity(h1v2);
            this.showScrollbar(h1v2, 1300);
        };
        this.ev_view_scroll = function(e) {
            if (e.target !== e.currentTarget) {
                return;
            }
            var scr = this.scrollable;
            var h1v2 = this.status.scrollLeft != scr.getScrollLeft() ? 1 : 2;
            var sb = this.scrollbars[h1v2];
            if (sb.prop.showing) {
                var time = (sb.prop.opacity == this.option.opacity_negative) ? 700 : 1300;
                this.showScrollbar(h1v2, time, sb.prop.opacity);
            }
            else if (scr.isScrollable(h1v2)) {
                if (scr.isRoot()) {
                    // for performance.
                    if (sb.prop.scrolling_tid) clearTimeout(sb.prop.scrolling_tid);
                    this.controller.hide();
                    sb.prop.scrolling_tid = setTimeout(bind(this, function() {
                        this.controller.show();
                        if (this.option.show_onscroll) {
                            this.showScrollbar(h1v2, 1300, this.option.opacity_negative);
                        }
                    }), 250);
                }
                else {
                    this.showScrollbar(h1v2, 700, this.option.opacity_negative);
                }
            }
            this.updateStatus();
        };
        this.updateStatus = function() {
            this.status.scrollTop = this.scrollable.getScrollTop();
            this.status.scrollLeft = this.scrollable.getScrollLeft();
        };
        this.showScrollbar = function showScrollbar(h1v2, hideAfter, opacity) {
            var sb = this.scrollbars[h1v2];
            if (sb.prop.holding) return;
            this.hideScrollbar(h1v2 == 1 ? 2 : 1);
            sb.body.update();
            sb.prop.opacity = sb.body.scrollbar.style.opacity = opacity || this.option.opacity_normal;
            sb.prop.showing = true;
            this.hideScrollbarLater(h1v2, hideAfter);
        };
        this.showScrollbarLater = function showScrollbar(h1v2, milliseconds, hideAfter, opacity) {
            var sb = this.scrollbars[h1v2];
            if (sb.prop.holding) return;
            if (sb.prop.showing) {
                this.showScrollbar(h1v2, hideAfter, opacity);
                return;
            }
            if (!sb.prop.show_id) {
                var later = runnable(
                    bind(this, this.clearShowScrollbarLater, h1v2),
                    bind(this, this.showScrollbar, h1v2, hideAfter, opacity)
                );
                sb.prop.show_id = setTimeout(later, milliseconds || 80);
            }
        };
        this.clearShowScrollbarLater = function showScrollbar(h1v2) {
            var sb = this.scrollbars[h1v2];
            if (sb.prop.holding) return;
            if (sb.prop.show_id) clearTimeout(sb.prop.show_id);
            sb.prop.show_id = null;
        };
        this.hideScrollbar = function hideScrollbar(h1v2, immediate) {
            this.clearShowScrollbarLater(h1v2);
            var sb = this.scrollbars[h1v2];
            if (sb.prop.holding) return;
            sb.prop.showing = false;
            if (immediate) {
                sb.prop.opacityAnim.clear();
                sb.body.scrollbar.style.opacity = 0;
            }
            else {
                sb.prop.opacityAnim.go('0.00');
            }
        };
        this.hideScrollbarLater = function hideScrollbarLater(h1v2, milliseconds) {
            var sb = this.scrollbars[h1v2];
            if (sb.prop.holding) return;
            this.clearShowScrollbarLater(h1v2);
            this.clearHideScrollbarLater(h1v2);
            sb.prop.hide_id = setTimeout(bind(this, this.hideScrollbar, h1v2), milliseconds || 1300);
        };
        this.clearHideScrollbarLater = function clearHideScrollbarLater(h1v2) {
            var sb = this.scrollbars[h1v2];
            if (sb.prop.holding) return;
            if (sb.prop.hide_id) clearTimeout(sb.prop.hide_id);
            sb.prop.hide_id = null;
            sb.prop.opacityAnim.clear();
        };
        this.holdScrollbarOpacity = function holdScrollbarOpacity(h1v2, opacity) {
            this.clearShowScrollbarLater(h1v2);
            this.clearHideScrollbarLater(h1v2);
            var sb = this.scrollbars[h1v2];
            sb.prop.holding = true;
            sb.prop.opacity = sb.body.scrollbar.style.opacity = opacity;
        };
        this.clearHoldScrollbarOpacity = function clearHoldScrollbarOpacity(h1v2) {
            var sb = this.scrollbars[h1v2];
            sb.prop.holding = false;
        };
        this.killScrollbar = function killScrollbar(h1v2, restoreAfter) {
            this.hideScrollbar(h1v2);
            var sb = this.scrollbars[h1v2];
            sb.body.detach();
            sb.prop.kill_id = setTimeout(bind(this, this.restoreScrollbar, h1v2), restoreAfter || 5000);
        };
        this.restoreScrollbar = function restoreScrollbar(h1v2) {
            var sb = this.scrollbars[h1v2];
            sb.body.attach();
            sb.prop.kill_id = null;
        };
    });
    
    /// class Scrollbars - Controller of scrollbars.
    function Scrollbars(container, option) {
        this.initialize.apply(this, arguments);
    }
    Scrollbars.Option = {
        smooth_scroll: true,
        scroll_unit: 120,
        backwardDistance: function(scr) { return scr.scrollable.getClientHeight() / 2; },
        forwardDistance : function(scr) { return scr.scrollable.getClientHeight() / 2; },
        pageupDistance  : function(scr) { return scr.scrollable.getClientHeight(); },
        pagedownDistance: function(scr) { return scr.scrollable.getClientHeight(); },
        endDistance     : function(scr) { return scr.scrollable.getScrollHeight(); },
        homeDistance    : function(scr) { return scr.scrollable.getScrollHeight(); },
        leftDistance    : function(scr) { return this.scroll_unit; },
        upDistance      : function(scr) { return this.scroll_unit; },
        rightDistance   : function(scr) { return this.scroll_unit; },
        downDistance    : function(scr) { return this.scroll_unit; }
    };
    (function(member) { member.apply(Scrollbars.prototype); })(function() {
        // class initialize.
        var lastClickedTarget = null;
        function setLastClicked(targetElement) {
            var target = targetElement;
            if (target && target.nodeType == 3) target = target.parentNode;
            while(target) {
                var style = document.defaultView.getComputedStyle(target);
                if (style.display == 'block') break;
                target = target.parentNode;
            }
            if (targetElement === lastClickedTarget) { // toggle.
                lastClickedTarget = null;
            }
            else {
                lastClickedTarget = targetElement;
            }
        }
        function lastClicked(container) {
            var target = lastClickedTarget;
            while(target) {
                if (target === container) return true;
                target = target.parentNode;
            }
            return false;
        }
        function document_mousedown(e) {
            setLastClicked(e.target);
        }
        function window_blur(e) {
            setLastClicked(null);
        }
        function document_keydown(e) {
            if (!Browser.Opera) processKey(e);
        }
        function document_keypress(e) {
            if (Browser.Opera) processKey(e);
        }
        function processKey(e) {
            if (e.returnValue === false) return; // already prevent default.
            if (!checkTarget(e)) return;
            var code = e.keyCode;
            var command;
            switch(code) {
                case 32: // space
                    if (!e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: e.shiftKey ? 'backward' : 'forward' };
                    break;
                case 33: // PageUp
                    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: 'pageup' };
                    break;
                case 34: // PageDown
                    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: 'pagedown' };
                    break;
                case 35: // End
                    if (!e.shiftKey && !e.altKey && !e.metaKey)
                        command = { command: 'end' };
                    break;
                case 36: // Home
                    if (!e.shiftKey && !e.altKey && !e.metaKey)
                        command = { command: 'home' };
                    break;
                case 37: // left
                    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: 'left' };
                    break;
                case 38: // up
                    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: 'up' };
                    break;
                case 39: // right
                    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: 'right' };
                    break;
                case 40: // down
                    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)
                        command = { command: 'down' };
                    break;
                default:
                    break;
            }
            if (command) {
                if (dispatchScrollEvent(command) == false) {
                    e.preventDefault();
                }
            }
        }
        function checkTarget(e) {
            if (e.target === e.currentTarget) return true;
            if (/^(?:TEXTAREA|INPUT|SELECT|BUTTON)$/.test(e.target.nodeName)) return false;
            return true;
        }
        function dispatchScrollEvent(command) {
            // @see http://javascript.g.hatena.ne.jp/edvakf/20100329/1269881699
            if (Browser.Opera) {
                var ev = document.createEvent('Event');
                ev.initEvent(SCROLLBAR_NAMESPACE + ':scroll', true, true);
                ev.data = command;
            }
            else {
                var ev = document.createEvent('MessageEvent');
                ev.initMessageEvent(SCROLLBAR_NAMESPACE + ':scroll', true, true,
                    command, location.href, '', window
                );
            }
            var target = document.activeElement;
            if (!target || target === document.body) target = lastClickedTarget || document.body;
            return target.dispatchEvent(ev);
        }
        Scrollbars.finalize = runnable(
            subscribe(document, 'mousedown', document_mousedown),
            subscribe(window, 'blur', window_blur),
            subscribe(document, 'keydown', document_keydown),
            subscribe(document, 'keypress', document_keypress)
        );
        // instance members.
        this.initialize = function initialize(container, option) {
            this.option = overridable(Scrollbars.Option);
            applyProperty(this.option, option);
            this.container = container || Sfn.getRoot();
            this.scrollable = new Scrollable(this.container);
            this.hScrollbar = new Scrollbar(this.scrollable, 1);
            this.vScrollbar = new Scrollbar(this.scrollable, 2);
            this.behavior = new ScrollbarBehavior(this);
            this.attach();
        };
        this.attach = function(e) {
            if (this.barckup) this.detach();
            
            var overflow_container = this.scrollable.isRoot() ? document.documentElement : this.container;
            this.barckup = {
                overflow_container: overflow_container,
                container_overflow_x: overflow_container.style.overflowX,
                container_overflow_y: overflow_container.style.overflowY,
                container_position: this.container.style.position
            };
            // set absolute origin for scroll bars.
            if (!this.scrollable.isRoot()) {
                if (document.defaultView.getComputedStyle(this.container, null).position == 'static') {
                    this.barckup.container_position_changed = true;
                    this.container.style.position = 'relative';
                }
            }
            overflow_container.style.overflow = 'hidden';
            
            this.hScrollbar.attach();
            this.vScrollbar.attach();
            this.attachEvents();
            this.attached = true;
        };
        this.detach = function(e) {
            this.hScrollbar.detach();
            this.vScrollbar.detach();
            this.detachEvents();
            if (this.barckup.container_position_changed) {
                this.container.style.position = this.barckup.container_position;
            }
            this.barckup.overflow_container.style.overflowX = this.barckup.container_overflow_x;
            this.barckup.overflow_container.style.overflowY = this.barckup.container_overflow_y;
            this.barckup = null;
            this.attached = false;
        };
        this.attachEvents = function() {
            if (this.detachEvents) this.detachEvents();
            var detach = [];
            if (this.scrollable.isRoot()) {
                detach.push(subscribe(window, 'scroll', bind(this, this.ev_view_scroll)));
                detach.push(subscribe(document, 'mousewheel', bind(this, this.ev_view_wheel)));
                detach.push(subscribe(document, 'mousedown', bind(this, this.ev_view_mousedown)));
                detach.push(subscribe(document, SCROLLBAR_NAMESPACE + ':scroll', bind(this, this.ev_do_scroll)));
            }
            else {
                detach.push(subscribe(this.container, 'scroll', bind(this, this.ev_view_scroll)));
                detach.push(subscribe(this.container, 'mousewheel', bind(this, this.ev_view_wheel)));
                detach.push(subscribe(this.container, 'mousedown', bind(this, this.ev_view_mousedown)));
                detach.push(subscribe(this.container, SCROLLBAR_NAMESPACE + ':scroll', bind(this, this.ev_do_scroll)));
            }
            detach.push(subscribe(window, 'resize', bind(this, this.update)));
            if (Browser.Opera && !this.scrollable.isRoot()) {
                // When the overflow property of ancestor's container is changed, this container's scroll position is reset(0, 0). 
                // Therefore, it is necessary to update it as much as possible. 
                //detach.push(subscribe(this.container, 'mousemove', bind(this, this.update)));
            }
            // delay attach for heavy initializing page. (like the fastladder)
            var delayAttach = bind(this, function() {
                if (detach) {
                    detach.push(subscribe(this.container, 'DOMNodeInserted', bind(this, this.update)));
                }
            });
            setTimeout(delayAttach, 5000);
            this.detachEvents = function() { if (detach) run(detach); detach = null; };
        };
        this.ev_view_scroll = function(e) {
            if (e.target === e.currentTarget) {
                this.update();
            }
        };
        this.ev_view_mousedown = function(e) {
            this.clearDragData();
            if (!this.scrollable.isRoot()) {
                var target = e.target;
                var on_sb = false;
                if (target == document.documentElement) {
                    target = this.container;
                }
                if (target != this.container && Sfn.isScrollable(target)) {
                    //TODO: fix
                    //var pos = getAbsolutePosition(this.container);
                    if (e.offsetX < target.clientLeft || e.offsetX > target.clientWidth  + target.clientLeft) return;
                    if (e.offsetX < target.clientTop  || e.offsetY > target.clientHeight + target.clientTop) return;
                    if (target.nodeName == 'TEXTAREA' && Browser.Opera) return;
                }
                while(target != this.container) {
                    if (target == this.vScrollbar.scrollbar) { on_sb = true; break; }
                    if (target == this.hScrollbar.scrollbar) { on_sb = true; break; }
                    target = target.parentNode;
                }
                if (!on_sb) {
                    //drag scroll support.
                    this.viewDragData = {
                        startTarget: e.target,
                        dispose: runnable(
                            subscribe(document, 'mousemove', bind(this, this.ev_view_dragging)),
                            subscribe(document, 'mouseup', bind(this, this.ev_view_draggend))
                        )
                    };
                }
            }
        };
        this.ev_view_dragging = function(e) {
            var data = this.viewDragData, scr = this.scrollable;
            var pos = getAbsolutePosition(this.container);
            var dx = null, dy = null, num = 0;
            if ((num = e.pageX - (pos.x + this.container.clientLeft)) < 0) {
                dx = 30 * ((num / 20 | 0) - 1);
            }
            else if ((num = e.pageX - (pos.x + this.container.clientWidth + this.container.clientLeft)) > 0) {
                dx = 30 * ((num / 20 | 0) + 1);
            }
            if ((num = e.pageY - (pos.y + this.container.clientTop)) < 0) {
                dy = 30 * ((num / 20 | 0) - 1);
            }
            else if ((num = e.pageY - (pos.y + this.container.clientHeight + this.container.clientTop)) > 0) {
                dy = 30 * ((num / 20 | 0) + 1);
            }
            if (dx == null && dy == null) {
                if (data.scrollTid) clearInterval(data.scrollTid);
                data.scrollTid = null;
            }
            else {
                data.dx = dx, data.dy = dy;
                if (!data.scrollTid) {
                    data.scrollTid = setInterval(function() {
                        scr.scrollBy(data.dx, data.dy);
                    }, 100);
                }
            }
        };
        this.ev_view_draggend = function(e) {
            this.clearDragData();
        };
        this.clearDragData = function(e) {
            if (this.viewDragData) {
                if (this.viewDragData.scrollTid) clearInterval(this.viewDragData.scrollTid);
                this.viewDragData.dispose();
                this.viewDragData = null;
            }
        }
        this.ev_view_wheel = function(e) {
            // for nested scrollbars. (If the inner scrollbars scrolled, the outer scrollbars do nothing.)
            if (e.returnValue === false) return;
            
            var target = e.target;
            var axis = e.axis || 2; // firefox's MouseScrollEvent has axis property.
            var u1d2 = wheelDelta(e) > 0 ? 1 : 2;
            var on_sb = false;
            if (target == document.documentElement) {
                target = this.container;
            }
            while(target != this.container) {
                if (target == this.vScrollbar.scrollbar) { on_sb = true; axis = 2; break; }
                if (target == this.hScrollbar.scrollbar) { on_sb = true; axis = 1; break; }
                if (Sfn.isScrollableNode(target, axis) && Sfn.isScrollable(target, axis, u1d2)) break;
                target = target.parentNode;
            }
            if (on_sb || target == this.container) {
                var do_scroll = this.scrollable.isScrollable(axis, u1d2);
                
                // scroll horizontal if it coundn't scroll vertical both directions and it scrollable horizontal to wheeled direction.
                if (!do_scroll && axis == 2) {
                    if (!this.scrollable.isScrollable(2) && this.scrollable.isScrollable(1, u1d2)) {
                        if ((this.scrollable.isRoot() && window.top === window.self) || lastClicked(this.container)) {
                            axis = 1;
                            do_scroll = true;
                        }
                    }
                }
                
                // native vertical scrolling for Opera by wheel on root container.
                // (prevent flickering while wheeling on iframe -> root window)
                if (do_scroll && axis == 2 && Browser.Opera && this.scrollable.isRoot()) {
                    do_scroll = false;
                }
                else // :-P
                if (do_scroll || (on_sb && this.scrollable.isScrollable(axis)) || (lastClicked(this.container) && this.scrollable.isScrollable())) {
                    e.preventDefault();
                    e.returnValue = false; // flag for nested scrollbars.
                }
                if (do_scroll) {
                    var delta = wheelDelta(e);
                    this.scrollable.scrollDirectBy(axis, -delta * this.option.scroll_unit, this.option.smooth_scroll);
                }
            }
        };
        this.ev_do_scroll = function(e) {
            var cmd = e.data.command;
            var axis, u1d2, dist;
            switch(cmd) {
                case 'backward': axis = 2; u1d2 = 1; dist = this.option.backwardDistance(this); break;
                case 'forward':  axis = 2; u1d2 = 2; dist = this.option.forwardDistance(this); break;
                case 'pageup':   axis = 2; u1d2 = 1; dist = this.option.pageupDistance(this); break;
                case 'pagedown': axis = 2; u1d2 = 2; dist = this.option.pagedownDistance(this); break;
                case 'end':      axis = 2; u1d2 = 2; dist = this.option.endDistance(this); break;
                case 'home':     axis = 2; u1d2 = 1; dist = this.option.homeDistance(this); break;
                case 'left':     axis = 1; u1d2 = 1; dist = this.option.leftDistance(this); break;
                case 'up':       axis = 2; u1d2 = 1; dist = this.option.upDistance(this); break;
                case 'right':    axis = 1; u1d2 = 2; dist = this.option.rightDistance(this); break;
                case 'down':     axis = 2; u1d2 = 2; dist = this.option.downDistance(this); break;
                default: return;
            }
            var target = e.target;
            var on_sb = false;
            if (target == document.documentElement) {
                target = this.container;
            }
            while(target != this.container) {
                if (target == this.vScrollbar.scrollbar) { on_sb = true; axis = 2; break; }
                if (target == this.hScrollbar.scrollbar) { on_sb = true; axis = 1; break; }
                if (Sfn.isScrollableNode(target, axis) && Sfn.isScrollable(target, axis, u1d2)) break;
                target = target.parentNode;
            }
            if (on_sb || target == this.container) {
                var do_scroll = this.scrollable.isScrollable(axis, u1d2);
                if (do_scroll || (on_sb && this.scrollable.isScrollable(axis))) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (do_scroll) {
                    this.scrollable.scrollDirectBy(axis, u1d2 == 1 ? -dist: dist, this.option.smooth_scroll);
                }
            }
        };
        this.update = function() {
            this.hScrollbar.update();
            this.vScrollbar.update();
        };
        this.setLayoutMethod = function(absolute_or_fixed) {
            this.hScrollbar.setLayoutMethod(absolute_or_fixed);
            this.vScrollbar.setLayoutMethod(absolute_or_fixed);
        };
        this.setPosition = function(br_bl_tr_tl) {
            this.hScrollbar.setPosition(br_bl_tr_tl);
            this.vScrollbar.setPosition(br_bl_tr_tl);
        };
        this.show = function() {
            this.hScrollbar.show();
            this.vScrollbar.show();
        };
        this.hide = function() {
            this.hScrollbar.hide();
            this.vScrollbar.hide();
        };
    });

    /// class Namespace.
    function Namespace(name, global) {
        if (this instanceof Namespace) return this;
        if (global == null) global = (function() { return this; })();
        return global[name] || (global[name] = new Namespace());
    }
    Namespace.prototype.extend = function use(props) {
        for(var k in props) if (!(k in this)) {
            this[k] = props[k];
        }
    };
    Namespace.prototype.use = function use(target) {
        if (!target) target = (function() { return this; })();
        for(var k in this) if (this.hasOwnProperty(k)) {
            target[k] = this[k];
        }
    };
    Namespace.prototype.unuse = function unuse(target) {
        if (!target) target = (function() { return this; })();
        for(var k in this) if (target[k] === this[k]) {
            delete target[k];
        }
    };
    Namespace.prototype.toString = function toString() {
        return '[object Namespace]';
    };
    
    var ns = Namespace(SCROLLBAR_NAMESPACE, window.opera || window);
    ns.extend({
        Smooth: Smooth,
        Scrollable: Scrollable,
        Scrollbar: Scrollbar,
        ScrollbarBehavior: ScrollbarBehavior,
        Scrollbars: Scrollbars
    });
    
    var startOverflow = {
        x: document.documentElement.style.overflowX,
        y: document.documentElement.style.overflowY
    };
    document.documentElement.style.overflow = 'hidden'; // hide scrollbars as soon as possible.

    var rootScrollbars = null;
    var disposeObserve = null;
    function initScrollbar() {

        rootScrollbars = new Scrollbars();
        rootScrollbars.behavior.option.show_onscroll = false;
        rootScrollbars.detach = function(eternally) {
            Scrollbars.prototype.detach.call(rootScrollbars);
            document.documentElement.style.overflowX = startOverflow.x;
            document.documentElement.style.overflowY = startOverflow.y;
            if (eternally) {
                if (disposeObserve) {
                    disposeObserve();
                    disposeObserve = null;
                }
                rootScrollbars = null;
                ns.Scrollbars.ROOT_SCROLLBARS = null;
            }
        };
        ns.Scrollbars.ROOT_SCROLLBARS = rootScrollbars;
        
        //test
        disposeObserve = subscribe(document, 'dblclick', function(e) {
            if (e.returnValue !== false) {
                var target = e.target;
                if (target.nodeType != 3 && !/^(INPUT|TEXTAREA|SELECT|IMG|OBJECT|IFRAME|SVG)$/.test(target.nodeName)) {
                    if (target.ownerDocument.defaultView.getSelection() == '') {
                        if (rootScrollbars.attached) rootScrollbars.detach();
                        else rootScrollbars.attach();
                    }
                }
            }
        });

        document.addEventListener(SCROLLBAR_NAMESPACE + ':enable', function() {
            if (!rootScrollbars.attached) rootScrollbars.attach();
        }, false);
        document.addEventListener(SCROLLBAR_NAMESPACE + ':disable', function() {
            if (rootScrollbars.attached) rootScrollbars.detach();
        }, false);
        document.addEventListener(SCROLLBAR_NAMESPACE + ':attach', function(e) {
            var cssQuery = e.data;
            if (!cssQuery || cssQuery.indexOf('*') >= 0) return;
            var items = document.querySelectorAll(cssQuery);
            for (var i = 0, len = items.length; i < len; i++) {
                if (Scrollable.fn.isScrollableNode(items[i])) {
                    var scrollbars = new Scrollbars(items[i]);
                }
            }
        }, false);
        
        return;
        
        //TODO
        if (getPref('ondemandscrollbar_killScrollbar')) {
            killScrollbar();
        }
    }
    
    var scrollbarWidth = 16;
    function killScrollbar() {
        setPref('ondemandscrollbar_killScrollbar', '1');
        if (scrollbar.offsetWidth) scrollbarWidth = scrollbar.offsetWidth;
        rootScrollbars.detach();
        setTimeout(function() {
            document.addEventListener('dblclick', observeDblclick, false);
        }, 100);
    }
    function observeDblclick(e) {
        if (e.pageX >= root.clientWidth - scrollbarWidth) {
            restoreScrollbar();
        }
    }
    function restoreScrollbar() {
        setPref('ondemandscrollbar_killScrollbar', null);
        document.removeEventListener('dblclick', observeDblclick, false);
        rootScrollbars.attach();
        showScrollbar(2000);
    }
    
    function getPref(key) {
        if (!window.localStorage) return null;
        return window.localStorage[key];
    }
    function setPref(key, value) {
        if (!window.localStorage) return;
        if (value == null) {
            localStorage.removeItem(key);
        }
        else {
            window.localStorage[key] = value;
        }
    }
    
    function main() {
        if (!document.body) return;
        initScrollbar();
    }
    function ready(func) {
        if (document.getElementsByTagName('body')[0]) func();
        else document.addEventListener('DOMContentLoaded', func, false);
    }
    ready(main);
})();


// ==UserScript==
// @name      ondemand scrollbar plugin - fastladder
// @version   1.00
// @include   http://fastladder.com/reader/
// @include   http://reader.livedoor.com/reader/
// ==/UserScript==
(function() {

    if (location.href.indexOf('http://fastladder.com/reader/') == 0 ||
        location.href.indexOf('http://reader.livedoor.com/reader/') == 0
    ); else return;

    function Namespace(name, global) {
        if (this instanceof Namespace) return this;
        if (global == null) global = (function() { return this; })();
        return global[name] || (global[name] = new Namespace());
    }

    var opera = window.opera;
    function init() {
        with (Namespace('http://www.hatena.ne.jp/miya2000/scrollbar/', opera || window)) {
            var sc = document.getElementById('subs_container');
            if (document.defaultView.getComputedStyle(sc).overflow == 'scroll') {
                sc.style.boxSizing = 'border-box';
                sc.style.borderBottom = 'transparent solid 16px';
                if ('WebkitBoxSizing' in sc.style) {
                    sc.style.WebkitBoxSizing = 'border-box';
                }
            }
            var rc = document.getElementById('right_container');
            if (document.defaultView.getComputedStyle(rc).overflow == 'scroll') {
                rc.style.boxSizing = 'border-box';
                rc.style.borderBottom = 'transparent solid 16px';
                if ('WebkitBoxSizing' in rc.style) {
                    rc.style.WebkitBoxSizing = 'border-box';
                }
            }
            var lcScroll = new Scrollbars(document.getElementById('subs_container'));
            //lcScroll.setPosition('BL');
            var barColor = '#B1D9FF';
            lcScroll.hScrollbar.thumb.style.backgroundColor = barColor;
            lcScroll.vScrollbar.thumb.style.backgroundColor = barColor;
            var rcScroll = new Scrollbars(document.getElementById('right_container'));
            rcScroll.hScrollbar.thumb.style.backgroundColor = barColor;
            rcScroll.vScrollbar.thumb.style.backgroundColor = barColor;
            window.addEventListener('mousewheel', function(e) {
                e.preventDefault();
            }, false);
            if (Scrollbars.ROOT_SCROLLBARS) {
                Scrollbars.ROOT_SCROLLBARS.detach(true);
            }
        }
    }

    (function ready(func) {
        if (document.getElementsByTagName('body')[0]) func();
        else window.addEventListener('load', func, false);
    })(function() {
        setTimeout(function() { init(); }, 0);
    });
})();


// ==UserScript==
// @name      ondemand scrollbar plugin - pre
// @version   1.00
// @include   *
// ==/UserScript==
(function() {

    var SCROLLBAR_NAMESPACE = 'http://www.hatena.ne.jp/miya2000/scrollbar/';
    function init() {
        var ev = document.createEvent('Event');
        ev.initEvent(SCROLLBAR_NAMESPACE + ':attach', true, false);
        ev.data = 'pre';
        document.dispatchEvent(ev);
    }

    (function ready(func) {
        if (document.getElementsByTagName('body')[0]) func();
        else window.addEventListener('load', func, false);
    })(function() {
        setTimeout(function() { init(); }, 0);
    });
})();

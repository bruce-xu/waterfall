(function (global, factory) {
    // 兼容AMD
    if (typeof define === 'function' && define.amd) {
        define(factory);
    }
    // 兼容CommonJS
    else if (typeof exports === 'object' && module === 'object') {
        exports = module.exports = factory();
    }
    // 浏览器端直接通过script标签引入
    else {
        global.Waterfall = factory();
    }
})(this, function () {

    // 检测`transition`的CSS属性名以及end事件名
    var TRANSLATION = (function () {
        var result = null;
        var translations = [
            {
                name: 'transition',
                cssName: 'transition',
                endEventName: 'transitionend'
            },
            {
                name: 'WebkitTransition',
                cssName: '-webkit-transition',
                endEventName: 'webkitTransitionEnd'
            },
            {
                name: 'MozTransition',
                cssName: '-moz-transition',
                endEventName: 'transitionend'
            },
            {
                name: 'OTransition',
                cssName: '-o-transition',
                endEventName: 'oTransitionEnd otransitionend'
            }
        ];

        var detectEl = document.createElement('div');
        var style = detectEl.style;
        each(translations, function (translation, index) {
            if (typeof style[translation.name] !== 'undefined') {
                result = translation;
                return false;
            }
        });

        return result;
    })();

    /**
     * 扩展对象属性
     *
     * @param {Object} target 目标对象
     * @param {...Object} source 源对象（列表）
     */
    function extend(target, source) {
        for (var i = 1, len = arguments.length; i < len; i++) {
            var obj = arguments[i];
            if (obj) {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        target[key] = obj[key];
                    }
                }
            }
        }
    }

    /**
     * 给函数绑定运行时的`this`对象
     *
     * @param {Function} fn 待绑定的函数
     * @param {Object} thisObj 绑定的`this`对象
     * @return {Function} 绑定了运行时`this`对象的新函数
     */
    function bind(fn, thisObj) {
        var args = [].slice.call(arguments, 2);
        return Function.prototype.bind
            ? Function.prototype.bind.apply(fn, [].slice.call(arguments, 1))
            : function () {
                fn.apply(thisObj, [].concat.apply(args, arguments));
            };
    }

    /**
     * 遍历集合，针对每一项调用相应的迭代函数
     *
     * @param {Array|Object} collection 待遍历集合
     * @param {Function} iterator 迭代函数
     */
    function each(collection, iterator) {
        if (collection.length) {
            for (var i = 0, len = collection.length; i < len; i++) {
                if (iterator(collection[i], i) === false) {
                    break;
                }
            }
        }
    }

    /**
     * 给DOM元素批量设置样式，避免多次单独设置，那样会造成多次reflow/repaint
     *
     * @param {HTMLElement} element 待设置样式的DOM元素
     * @param {Array} styles 批量样式数组
     */
    function applyStyle(element, styles) {
        // For most browsers
        if (typeof element.style.cssText !== 'undefined') {
            element.style.cssText += styles.join(';');
        }
        // For some bt browser
        else {
            var style = element.getAttribute('style');
            element.setAttribute('style', style + (style ? ';' : '' + styles.join(';')));
        }
    }

    /**
     * 获取DOM元素的所有样式对象
     *
     * @param {HTMLElement} element 待获取样式的元素
     * @return {Object} 样式对象值
     */
    function getStyles(element) {
        // For non-IE
        if (window.getComputedStyle) {
            return window.getComputedStyle(element, null);
        }
        // For IE/opera
        else if (element.currentStyle) {
            return element.currentStyle;
        }
        else {
            return {};
        }
    }

    /**
     * 注册事件
     *
     * @param {HTMLElement} element 待注册事件元素
     * @param {string} type 事件类型
     * @param {Function} handler 事件处理函数
     */
    function addEvent(element, type, handler) {
        if (element.addEventListener) {
            element.addEventListener(type, handler, false);
        }
        else if (element.attachEvent) {
            element.attachEvent('on' + type, handler);
        }
        else {
            element['on' + type] = handler;
        }
    }

    /**
     * 获取元素`container`下的符合`selector`的子元素
     *
     * @param {HTMLElement} container 父容器元素
     * @param {string} selector 选择符，类名或标签名
     * @return {NodeList|Array.<HTMLElement>} 查找出的元素集合（NodeList集合或HTMLElement类型的数组，
     *   由于使用时只会遍历获取每一项操作，NodeList和Array此操作无差别，就不做类型转换了）
     */
    function getItems(container, selector) {
        if (!selector) {
            return container.children;
        }

        if (container.querySelectorAll) {
            return container.querySelectorAll(selector);
        }

        var isClassSelector = selector[0] === '.';
        return isClassSelector
            ? container.getElementsByClassName(selector.slice(1))
            : container.getElementsByTagName(selector);
    }

    /**
     * 渲染元素
     *
     * @param {Object} thisObj this对象（Waterfall对象）
     * @param {HTMLElement} item 待渲染的元素
     */
    function renderItem(thisObj, item) {
        var columnHeights = thisObj._columnHeights;
        var minIndex = 0;
        // 取到每一列中当前高度最小的一列，当前图片会被添加到这一列
        for (var i = 1; i < columnHeights.length; i++) {
            if (columnHeights[i] < columnHeights[minIndex]) {
                minIndex = i;
            }
        }

        var styles = [
            'visibility: visible',
            'position: absolute',
            'left: ' + (thisObj._offsetLeft + minIndex * thisObj._offsetWidth) + 'px',
            'top: ' + (columnHeights[minIndex]) + 'px',
            'width: ' + thisObj._contentWidth + 'px'
        ];

        if (thisObj.animation) {
            styles.push('opacity: 1');
        }

        applyStyle(item, styles);

        columnHeights[minIndex] += item.offsetHeight + thisObj._verticalMargin;
    }

    /**
     * 图片加载完成事件处理函数
     *
     * @param {Object=} e 事件对象
     * @param {HTMLImageElement=} img 加载完的图片元素
     */
    function onImgLoaded(e, img) {
        var target;
        // 对应于`img.complete`分支
        if (e === null && img) {
            target = img;
        }
        else {
            var event = e || window.event;
            target = event.target || event.srcElement;
        }

        var container = this.container;
        var imgWrapper = target.parentElement;
        var itemClass = this.itemClass;
        if (itemClass) {
            // 可能图片直接包裹在`imgWrapper`里面，也可能中间隔了几层元素，所以遍历一下，下同
            while (imgWrapper && imgWrapper.className.indexOf(itemClass) === -1) {
                imgWrapper = imgWrapper.parentElement;
            }
        }
        else {
            var upWrapper = imgWrapper;
            while (upWrapper !== container) {
                imgWrapper = upWrapper;
                upWrapper = upWrapper.parentElement;
            }
        }

        renderItem(this, imgWrapper);
    }

    /**
     * 给图片绑定`onload`事件
     *
     *  - 由于图片通过网络加载需要时间，所以应用瀑布流代码时，可能很多图片还没加载完，此时还无法获取图片的宽、高，
     *  - 因此无法计算布局（当然，如果代码是写在`window.onload`中的可忽略，此时图片已全部加载完成，但如果有异步
     *  - 请求分页数据并前端渲染的场景，依然会有上述情况）。所以需遍历图片，添加`onload`事件，待图片加载完成后计算
     *  - 布局并展示出来。（但是有一个问题是图片的加载完成时间是不一定的，所以在DOM树中靠后的图片可能会比靠前的图片
     *  - 先加载完，所以最终呈现位置和DOM树中的位置可能不同。不过不要在意这些细节，如果非要保持顺序一致的话，也可以
     *  - 把代码放在`window.onload`中执行或有分页加载的情况下通过所有图片的`onload`事件都触发后再统一计算位置呈
     *  - 现来解决，此处就不实现此变态需求了）
     *
     * @param {Object} thisObj this对象（Waterfall对象）
     */
    function bindImgLoaded(thisObj) {
        var items = getItems(thisObj.container, thisObj.itemClass);
        var imgs = [];
        // 过滤掉已经渲染过的元素
        each(items, function (item) {
            // 未加载完成或未被注册过`load`事件的新元素
            if (item.getAttribute('data-waterfall') === null) {
                // 虽然正常情况每项下只会有一张图片，但不排除有超过一张的变态情况
                var innerImgs = getItems(item, 'img');
                [].push.apply(imgs, innerImgs);

                item.setAttribute('data-waterfall', '');

                var styles = ['visibility: hidden'];
                if (thisObj.animation && TRANSLATION) {
                    var duration = thisObj.duration ? parseInt(thisObj.duration) : 1;
                    styles.push('opacity: 0', TRANSLATION.cssName + ': opacity ' + duration + 's');
                }

                applyStyle(item, styles);
            }
        });

        // img的`onload`事件中需要读取Waterfall对象的属性，所以此处绑定`this`值
        var onThisImgLoaded = bind(onImgLoaded, thisObj);
        each(imgs, function (img, i) {
            // 图片已加载完成
            if (img.complete) {
                onThisImgLoaded(null, img);
            }
            else {
                addEvent(img, 'load', onThisImgLoaded);
            }
        });
    }

    /**
     * 初始化
     *
     * @param {Object} thisObj this对象（Waterfall对象）
     */
    function init(thisObj) {
        var items = getItems(thisObj.container, thisObj.itemClass);
        var firstItem = items[0];
        if (!firstItem) {
            return;
        }

        // 此处瀑布流实现中有一个前提是每一项宽度相同高度不定。所以基于此前提，初始化时获取第一项的样式，
        // 取到宽度等值作为基准
        var cssStyles = getStyles(firstItem);
        var width = parseInt(cssStyles.width);
        var marginTop = parseInt(cssStyles.marginTop);
        var marginBottom = parseInt(cssStyles.marginBottom);
        var marginHorizontal = parseInt(cssStyles.marginLeft) + parseInt(cssStyles.marginRight);
        var paddingHorizontal = parseInt(cssStyles.paddingLeft) + parseInt(cssStyles.paddingRight);
        var borderHorizontal = parseInt(cssStyles.borderLeftWidth) + parseInt(cssStyles.borderRightWidth);

        // 如果CSS中有设置`box-sizing`属性，则通过`cssStyles.width`获取宽度时，
        // 其实此宽度是包含了`border`、`padding`、`width`三项值的盒模型的宽度，
        // 而非盒模型中内容区域的宽度。所以需要区分此CSS属性
        var isBorderBox = cssStyles.boxSizing === 'border-box';

        // 如上述构造函数处的参数说明介绍，参数`itemWidth`会被当成盒模型的总宽度，而非盒模型内容区域的宽度
        // 如果参数中设置了`itemWidth`参数，此处则直接使用，否则用下面的方式获取
        // 宽度也可以通过`margin`+`border`+`padding`+`width`一项项加起来，太繁琐，
        // 此处直接取`offsetWidth`（包含了`border`+`padding`+`width`）
        thisObj._contentWidth = thisObj.itemWidth
            ? (isBorderBox ? thisObj.itemWidth : thisObj.itemWidth - borderHorizontal - paddingHorizontal)
            : width;
        thisObj._boxModelWidth = thisObj.itemWidth || (isBorderBox ? width : firstItem.offsetWidth);
        thisObj._offsetWidth = thisObj._boxModelWidth + marginHorizontal;
        thisObj._verticalMargin = marginTop + marginBottom;

        // 瀑布流所在容器的总宽度
        var containerWidth = thisObj.container.clientWidth;
        // 计算得到可以显示的总列数
        var column = Math.floor(containerWidth / thisObj._offsetWidth);

        // `_columnHeights`中保存每一列当前的高度
        thisObj._columnHeights = [];

        // 初始化每列的初始高度
        for (var i = 0; i < column; i++) {
            thisObj._columnHeights[i] = 0;
        }

        // 如果需要相对于`container`居中对齐的话，设置一个左边的偏移量
        thisObj._offsetLeft = thisObj.middle
            ? (containerWidth - thisObj._offsetWidth * column) / 2
            : 0;

        // 瀑布流图片需要相对于`container`做绝对定位，所以`container`需要设置`position`为`relative`
        thisObj.container.style.position = 'relative';
    };

    /**
     * 瀑布流图片布局构造函数
     *
     * @param {Object} options 配置参数
     * @param {HTMLElement} options.container（required）包含瀑布流图片的DOM容器元素
     * @param {string} options.itemClass（optional）每一张图片外层DOM元素的class名，不传的话会取`container`的直接子节点
     * @param {number} options.itemWidth（optional）每一张图片外层DOM元素的盒模型宽度。
     *  -（我觉得站在使用者的角度来看，当其设置`itemWidth`参数时，应该是期望设置盒模型的宽度，及`border`+`padding`+`width`）
     *  - 一般瀑布流图片都是定宽不定高的，所以如果不传`itemWidth`，会取第一张图片的容器的宽度（包含border、padding、width）
     * @param {boolean} options.middle（optional）是否居中显示瀑布流内容
     * @param {boolean} options.animation（optional）图片加载完展现时是否有动画效果
     * @param {number} options.duration（optional）动画时长（单位：秒）
     */
    function Waterfall(options) {
        options = options || {};
        var container = options.container;
        if (!(typeof container !== 'undefined'&& container instanceof Node && container.nodeType === 1)) {
            throw new Error('You must set a `HTMLElement` type parameter: `container`');
        }

        if (!(this instanceof Waterfall)) {
            return new Waterfall(options);
        }

        var defaultOptions = {
            container: null,
            itemWidth: 0,
            itemClass: '',
            middle: true,
            animation: true,
            duration: 1
        };

        extend(this, defaultOptions, options);

        init(this);

        this.render();
    }

    /**
     * 渲染
     */
    Waterfall.prototype.render = function () {
        bindImgLoaded(this);
    };

    return Waterfall;
});

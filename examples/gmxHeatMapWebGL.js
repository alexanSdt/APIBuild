/*
 (c) 2014, Sergey Alekseev
 Leaflet.HeatMapWebGL, plugin for Gemixer layers.
*/
L.HeatMapWebGL = L.Class.extend({

    options: {
        pane: 'markerPane',
        size: 50,
        opacity: 0.1,
        gradientTexture: false,
        alphaRange: 1
    },

    setData: function (data) {
        this.data = data;
    },

    initialize: function (map, options) {
        this.data = [];
        L.setOptions(this, options);
    },

    redraw: function () {
        if (this._map && !this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
        map.getPanes()[this.options.pane].appendChild(this._canvas);

        map.on('moveend', this._reset, this);
        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._reset();
    },

    onRemove: function (map) {
        map.getPanes()[this.options.pane].removeChild(this._canvas);

        map.off('moveend', this._reset, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        if (!this._canvas.parentNode) {
            map.getPanes()[this.options.pane].appendChild(this._canvas);
        }
        map.addLayer(this);
        return this;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

        this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    },

    _initCanvas: function () {
        var canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer'),
            size = this._map.getSize();
        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

        var options = this.options;
        this.WebGLHeatMap = createWebGLHeatmap({ 
            canvas: canvas, 
            gradientTexture: options.gradientTexture, 
            alphaRange: [0, options.alphaRange]
        });
    },

    _updateBbox: function () {
        var _map = this._map,
            screenBounds = _map.getBounds(),
            southWest = screenBounds.getSouthWest(),
            northEast = screenBounds.getNorthEast(),
            ww = gmxAPIutils.worldWidthMerc,
            ww2 = 2 * ww,
            m1 = L.Projection.Mercator.project(southWest),
            m2 = L.Projection.Mercator.project(northEast),
            w = (m2.x - m1.x) / 2,
            center = (m1.x + m2.x) / 2;
        center %= ww2;
        if (center > ww) center -= ww2;
        else if (center < -ww) center += ww2;

        this.mInPixel = gmxAPIutils.getPixelScale(_map._zoom);
        this._ctxShift = [(w - center) * this.mInPixel, m2.y * this.mInPixel];
    },

    _reset: function () {
        var _map = this._map,
            size = _map.getSize(),
            _canvas = this._canvas,
            mapTop = _map._getTopLeftPoint(),
            topLeft = _map.containerPointToLayerPoint([0, mapTop.y < 0 ? -mapTop.y : 0]);

        this._updateBbox();
        L.DomUtil.setPosition(_canvas, topLeft);
        _canvas.width = size.x; _canvas.height = size.y;
        this.WebGLHeatMap.adjustSize();
        this.redraw();
    },

    _redraw: function () {
        var heatmap = this.WebGLHeatMap;
        heatmap.clear();
        if (this.data) {
            var dataLen = this.data.length;
            var out = [],
                size = this.options.size,
                opacity = this.options.opacity,
                _zoom = this._map._zoom,
                ctxShift = this._ctxShift,
                mInPixel = this.mInPixel;
            
            for (var i = 0; i < dataLen; i++) {
                var it = this.data[i].properties,
                    geo = it[it.length - 1],
                    coord = geo.coordinates;
                heatmap.addPoint(
                    Math.floor(coord[0] * mInPixel + ctxShift[0]),
                    Math.floor(ctxShift[1] - coord[1] * mInPixel)
                    ,
                    20
                    // ,
                    // opacity
                );
            }
            heatmap.update();
            heatmap.display();
        }
        this._frame = null;
    }
});

L.heatMapWebGL = function (map, options) {
    return new L.HeatMapWebGL(map, options);
};

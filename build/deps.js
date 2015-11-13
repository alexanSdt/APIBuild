var depsJS = [
    "external/Leaflet-GeoMixer/src/Parsers.js",
    "external/Leaflet-GeoMixer/src/Deferred.js",
    "external/Leaflet-GeoMixer/src/ImageLoader.js",
    "external/Leaflet-GeoMixer/src/ProjectiveImage.js",
    "external/Leaflet-GeoMixer/src/StyleManager.js",
    "external/Leaflet-GeoMixer/src/ScreenVectorTile.js",
    "external/Leaflet-GeoMixer/src/VectorTile.js",
    "external/Leaflet-GeoMixer/src/TilesTree.js",
    "external/Leaflet-GeoMixer/src/DataManager.js",
    "external/Leaflet-GeoMixer/src/Observer.js",
    "external/Leaflet-GeoMixer/src/LabelsLayer.js",
    "external/Leaflet-GeoMixer/src/Utils.js",
    "external/Leaflet-GeoMixer/src/DrawCanvas.js",
    "external/Leaflet-GeoMixer/src/ImageTransform.js",
    "external/Leaflet-GeoMixer/src/SessionManager.js",
    "external/Leaflet-GeoMixer/src/MapManager.js",
    "external/Leaflet-GeoMixer/src/EventsManager.js",
    "external/Leaflet-GeoMixer/src/VectorTileLoader.js",
    "external/Leaflet-GeoMixer/src/VectorLayer.js",
    "external/Leaflet-GeoMixer/src/VectorLayer.Popup.js",
    "external/Leaflet-GeoMixer/src/VectorLayer.Hover.js",
    "external/Leaflet-GeoMixer/src/RasterLayer.js",
    "external/Leaflet-GeoMixer/src/LayerFactory.js",
    "external/Leaflet-GeoMixer/src/LayersVersion.js",
    "external/Leaflet-GeoMixer/src/ObjectsReorder.js",
    "external/Leaflet-GeoMixer/src/Locale.js",
    "external/Leaflet-GeoMixer/src/lang_ru.js",
    "external/Leaflet-GeoMixer/src/lang_en.js",
    "external/Leaflet-GeoMixer/src/MarkerCluster.js",
    "external/Leaflet-GeoMixer/src/ClipPolygon.js"
    ,
    "external/gmxControls/src/js/gmxPosition.js",
    "external/gmxControls/src/js/gmxControlsManager.js",
    "external/gmxControls/src/js/L.Control.gmxIcon.js",
    "external/gmxControls/src/js/L.Control.gmxIconGroup.js",
    "external/gmxControls/src/js/L.Control.gmxDrawing.js", 
    "external/gmxControls/src/locale/L.Control.gmxDrawing.locale.ru.js",
    "external/gmxControls/src/locale/L.Control.gmxDrawing.locale.en.js",
    "external/gmxControls/src/js/L.Control.gmxCenter.js",
    "external/gmxControls/src/js/L.Control.gmxHide.js",
    "external/gmxControls/src/js/L.Control.gmxLayers.js",
    "external/gmxControls/src/js/L.Control.gmxLocation.js",
    "external/gmxControls/src/js/L.Control.gmxCopyright.js",
    "external/gmxControls/src/js/L.Control.gmxZoom.js",
    "external/gmxControls/src/js/L.Control.gmxBottom.js",
    "external/gmxControls/src/js/L.Control.gmxLogo.js",
    "external/gmxControls/src/js/L.Control.gmxSidebar.js",
    "external/gmxControls/src/js/L.Control.gmxLoaderStatus.js"
    ,
    "external/gmxDrawing/src/L.GmxDrawing.js",
    "external/gmxDrawing/src/L.GmxDrawing.Feature.js",
    "external/gmxDrawing/src/L.GmxDrawing.Ring.js",
    "external/gmxDrawing/src/L.GmxDrawing.PointMarkers.js",
    "external/gmxDrawing/src/L.GmxDrawing.utils.js"
    ,
    "external/Leaflet.TileLayer.Mercator/src/TileLayer.Mercator.js"
    ,
    "external/Leaflet.imageTransform/src/L.ImageTransform.js"
    ,
    "external/Leaflet.gmxGrid/src/Leaflet.gmxGrid.js"
    ,
    "external/Leaflet.gmxBaseLayersManager/src/gmxBaseLayersManager.js",
    "external/Leaflet.gmxBaseLayersManager/src/initBaseLayerManager.js"
];
var depsCSS = [
    "external/gmxControls/src/css/L.Control.gmxIcon.css",
    "external/gmxControls/src/css/L.Control.gmxIconGroup.css",
    "external/gmxControls/src/css/L.Control.gmxDrawing.css",
    "external/gmxControls/src/css/L.Control.gmxCenter.css",
    "external/gmxControls/src/css/L.Control.gmxHide.css",
    "external/gmxControls/src/css/L.Control.gmxLayers.css",
    "external/gmxControls/src/css/L.Control.gmxLocation.css",
    "external/gmxControls/src/css/L.Control.gmxCopyright.css",
    "external/gmxControls/src/css/L.Control.gmxZoom.css",
    "external/gmxControls/src/css/L.Control.gmxBottom.css",
    "external/gmxControls/src/css/L.Control.gmxLogo.css",
    "external/gmxControls/src/css/L.Control.gmxSidebar.css",
    "external/gmxControls/src/css/L.Control.gmxLoaderStatus.css",
    "external/gmxControls/src/css/external.css"
    ,
    "external/gmxDrawing/css/L.gmxDrawing.css"
];

if (typeof exports !== 'undefined') {
	exports.depsJS = depsJS;
	exports.depsCSS = depsCSS;
}

if (typeof gmxAPIv2DevOnLoad === 'function') {
	gmxAPIv2DevOnLoad(depsJS, depsCSS);
} else if (typeof gmxAPI !== 'undefined' && typeof gmxAPI.gmxAPIv2DevLoader === 'function') {
	gmxAPI.gmxAPIv2DevLoader(depsJS, depsCSS);
}

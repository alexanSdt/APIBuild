var apiFiles = [
	{
		key: 'Leaflet-0.7.7',						// path in external
		pub: {
			js: ['dist/leaflet.js'],
			css: ['dist/leaflet.css'],
			img: { src: 'dist/images', out: 'images' }
		},
		dev: {
			js: ['dist/leaflet-src.js'],
			css: ['dist/leaflet.css']
		}
	},
	{
		key: 'Leaflet-GeoMixer',
		mobiles: true,								// build for mobiles
		pub: {
			jake: 'jake build',
			js: ['dist/leaflet-geomixer-src.js']
		},
		dev: {
		}
	},
	{
		key: 'gmxControls',
		pub: {
			jake: 'jake build',
			js: ['dist/gmxControls-src.js'],
			css: ['dist/css/gmxControls.css'],
			img: { src: 'dist/css/img', out: 'img'}
		},
		dev: {
		}
	},
	{
		key: 'gmxDrawing',
		pub: {
			jake: 'jake build',
			js: ['dist/gmxDrawing-src.js'],
			css: ['dist/css/gmxDrawing.css']
		},
		dev: {
		}
	},
	{
		key: 'Leaflet.gmxGrid',
		pub: {
			js: ['src/Leaflet.gmxGrid.js']
		},
		dev: {
			js: ['src/Leaflet.gmxGrid.js']
		}
	},
	{
		key: 'Leaflet.TileLayer.Mercator',
		pub: {
			js: ['src/TileLayer.Mercator.js']
		},
		dev: {
			js: ['src/TileLayer.Mercator.js']
		}
	},
	{
		key: 'Leaflet.gmxBaseLayersManager',
		pub: {
			js: ['src/gmxBaseLayersManager.js', 'src/initBaseLayerManager.js']
		},
		dev: {
			js: ['src/gmxBaseLayersManager.js', 'src/initBaseLayerManager.js']
		}
	},
	{
		key: 'Leaflet.contextmenu',
		pub: {
			js: ['dist/leaflet.contextmenu.js'],
			css: ['dist/leaflet.contextmenu.css']
		},
		dev: {
			js: ['dist/leaflet.contextmenu.js'],
			css: ['dist/leaflet.contextmenu.css']
		}
	},
	{
		key: 'Leaflet.heat',
		pub: {
			js: ['dist/leaflet-heat.js']
		},
		dev: {
			js: ['dist/leaflet-heat.js']
		}
	},
	{
		key: 'Leaflet.markercluster',
		pub: {
			js: ['dist/leaflet.markercluster-src.js'],
			css: ['dist/MarkerCluster.css', 'dist/MarkerCluster.Default.css']
		},
		dev: {
			js: ['dist/leaflet.markercluster-src.js'],
			css: ['dist/MarkerCluster.css', 'dist/MarkerCluster.Default.css']
		}
	}
/*
  
    "external/Leaflet-GeoMixer/src/commonjs.js",
    "external/Leaflet-GeoMixer/src/Parsers.js",
    "external/Leaflet-GeoMixer/src/Deferred.js",
    "external/Leaflet-GeoMixer/src/ImageLoader.js",
    "external/Leaflet-GeoMixer/src/Utils.js",
    "external/Leaflet-GeoMixer/src/DrawCanvas.js", 
    "external/Leaflet-GeoMixer/src/SessionManager.js",
    "external/Leaflet-GeoMixer/src/MapManager.js",
    "external/Leaflet-GeoMixer/src/GeomixerMap.js",
    "external/Leaflet-GeoMixer/src/EventsManager.js",
    "external/Leaflet-GeoMixer/src/Locale.js",
    "external/Leaflet-GeoMixer/src/lang_ru.js",
    "external/Leaflet-GeoMixer/src/lang_en.js",
    
    "external/Leaflet-GeoMixer/src/DataManager/VectorTileLoader.js",
    "external/Leaflet-GeoMixer/src/DataManager/VectorTile.js",
    "external/Leaflet-GeoMixer/src/DataManager/Observer.js",
    "external/Leaflet-GeoMixer/src/DataManager/TilesTree.js",
    "external/Leaflet-GeoMixer/src/DataManager/DataManager.js",

    "external/Leaflet-GeoMixer/src/Layer/VectorLayer.js",
    "external/Leaflet-GeoMixer/src/Layer/ScreenVectorTile.js",
    "external/Leaflet-GeoMixer/src/Layer/ObjectsReorder.js",
    "external/Leaflet-GeoMixer/src/Layer/StyleManager.js",
    "external/Leaflet-GeoMixer/src/Layer/VectorLayer.Popup.js",
    "external/Leaflet-GeoMixer/src/Layer/VectorLayer.Hover.js",
    "external/Leaflet-GeoMixer/src/Layer/LayersVersion.js",
    "external/Leaflet-GeoMixer/src/Layer/RasterLayer.js",
    "external/Leaflet-GeoMixer/src/Layer/LabelsLayer.js",
    "external/Leaflet-GeoMixer/src/Layer/ClipPolygon.js",
    "external/Leaflet-GeoMixer/src/Layer/ImageTransform.js",
    "external/Leaflet-GeoMixer/src/Layer/ProjectiveImage.js",
    
    "external/Leaflet-GeoMixer/src/Layer/external/ExternalLayer.js",
    "external/Leaflet-GeoMixer/src/Layer/external/BindWMS.js",
    "external/Leaflet-GeoMixer/src/Layer/external/HeatMap.js",
    "external/Leaflet-GeoMixer/src/Layer/external/MarkerCluster.js",

    "external/Leaflet-GeoMixer/src/LayerFactory.js",

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
	*/
];

var jsFilesThidparty = [
    "leaflet/leaflet.js"
];

var cssFiles = [
/*
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
*/
];

var moduleFiles = {
};

module.exports = {
    apiFiles: apiFiles,
    mobiles: ['Leaflet-0.7.7', 'Leaflet-GeoMixer'],
    cssFiles: cssFiles,
    moduleFiles: moduleFiles
}
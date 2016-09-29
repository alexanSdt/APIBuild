var apiFiles = [
	{
		key: 'Leaflet-0.7.7',						// path in external
		js: ['dist/leaflet-src.js'],
		css: ['dist/leaflet.css'],
		img: { src: 'dist/images', out: 'images' }
	},
	{
		key: 'Leaflet-GeoMixer',
		mobiles: true,								// build for mobiles
		deps: 'build/deps.js',
		srcPath: 'src/',
		jake: 'jake build',
		js: ['dist/leaflet-geomixer-src.js']
	},
	{
		key: 'gmxControls',
		deps: 'build/deps.js',
		jake: 'jake build',
		js: ['dist/gmxControls-src.js'],
		css: ['dist/css/gmxControls.css'],
		img: { src: 'dist/css/img', out: 'img'}
	},
	{
		key: 'gmxDrawing',
		deps: 'build/deps.js',
		jake: 'jake build',
		js: ['dist/gmxDrawing-src.js'],
		css: ['dist/css/gmxDrawing.css']
	},
	{
		key: 'Leaflet.gmxGrid',
		js: ['src/Leaflet.gmxGrid.js']
	},
	{
		key: 'Leaflet.imageTransform',
		js: ['src/L.ImageTransform.js']
	},
	{
		key: 'Leaflet.TileLayer.Mercator',
		js: ['src/TileLayer.Mercator.js']
	},
	{
		key: 'Leaflet.gmxBaseLayersManager',
		js: ['src/gmxBaseLayersManager.js', 'src/initBaseLayerManager.js']
	},
	{
		key: 'Leaflet.contextmenu',
		js: ['dist/leaflet.contextmenu.js'],
		css: ['dist/leaflet.contextmenu.css']
	},
	{
		key: 'Leaflet.heat',
		js: ['dist/leaflet-heat.js']
	},
	{
		key: 'Leaflet.markercluster',
		js: ['dist/leaflet.markercluster-src.js'],
		css: ['dist/MarkerCluster.css', 'dist/MarkerCluster.Default.css']
	},
	{
		key: 'GMXVirtualTileLayer',
		js: ['GmxVirtualTileLayer.js']
	}
];

module.exports = {
    apiFiles: apiFiles
}

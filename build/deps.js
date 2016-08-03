var apiFiles = [
	{
		key: 'Leaflet-0.7.7',						// path in external
		pub: {
			js: ['dist/leaflet-src.js'],
			css: ['dist/leaflet.css'],
			img: { src: 'dist/images', out: 'images' }
		}
	},
	{
		key: 'Leaflet-GeoMixer',
		mobiles: true,								// build for mobiles
		pub: {
			deps: 'build/deps.js',
			srcPath: 'src/',
			jake: 'jake build',
			js: ['dist/leaflet-geomixer-src.js']
		}
	},
	{
		key: 'gmxControls',
		pub: {
			deps: 'build/deps.js',
			jake: 'jake build',
			js: ['dist/gmxControls-src.js'],
			css: ['dist/css/gmxControls.css'],
			img: { src: 'dist/css/img', out: 'img'}
		}
	},
	{
		key: 'gmxDrawing',
		pub: {
			deps: 'build/deps.js',
			jake: 'jake build',
			js: ['dist/gmxDrawing-src.js'],
			css: ['dist/css/gmxDrawing.css']
		}
	},
	{
		key: 'Leaflet.gmxGrid',
		pub: {
			js: ['src/Leaflet.gmxGrid.js']
		}
	},
	{
		key: 'Leaflet.TileLayer.Mercator',
		pub: {
			js: ['src/TileLayer.Mercator.js']
		}
	},
	{
		key: 'Leaflet.gmxBaseLayersManager',
		pub: {
			js: ['src/gmxBaseLayersManager.js', 'src/initBaseLayerManager.js']
		}
	},
	{
		key: 'Leaflet.contextmenu',
		pub: {
			js: ['dist/leaflet.contextmenu.js'],
			css: ['dist/leaflet.contextmenu.css']
		}
	},
	{
		key: 'Leaflet.heat',
		pub: {
			js: ['dist/leaflet-heat.js']
		}
	},
	{
		key: 'Leaflet.markercluster',
		pub: {
			js: ['dist/leaflet.markercluster-src.js'],
			css: ['dist/MarkerCluster.css', 'dist/MarkerCluster.Default.css']
		}
	}
];

module.exports = {
    apiFiles: apiFiles
}
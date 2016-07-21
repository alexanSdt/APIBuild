var fs = require('fs'),
    ncp = require('ncp').ncp,
    UglifyJS = require('uglify-js'),
    deps = require('./build/deps.js'),
    depsJS = deps.depsJS,
    depsCSS = deps.depsCSS;

function combineFiles(files) {
	var content = '';
	for (var i = 0, len = files.length; i < len; i++) {
		content += fs.readFileSync(files[i], 'utf8') + '\n\n';
	}
	return content;
}
function chkDistPath() {
	if (!fs.existsSync('dist')) { 
		fs.mkdirSync('dist');
    }
    
    if (!fs.existsSync('dist/css')) {
		fs.mkdirSync('dist/css');
	}
}

exports.build = function () {

	console.log('Concatenating ' + depsJS.length + ' JS files...');
	chkDistPath();

	var copy = fs.readFileSync('external/Leaflet-GeoMixer/src/copyright.js', 'utf8'),
        intro = '(function () {\n"use strict";\n',
	    outro = '}());',
	    newSrc = copy + intro + combineFiles(depsJS) + outro,
	    pathPart = 'dist/leaflet-geomixer-all',
	    srcPath = pathPart + 'src.js';

	console.log('\tUncompressed size: ' + newSrc.length + ' bytes');

	fs.writeFileSync(srcPath, newSrc);
	fs.writeFileSync(pathPart + '-src.js', newSrc);
	console.log('\tSaved to ' + srcPath);

	console.log('Compressing...');

	var path = pathPart + 'min.js',
		newCompressed = copy + UglifyJS.minify(newSrc, {
			warnings: true,
			fromString: true
		}).code;

	console.log('\tCompressed size: ' + newCompressed.length + ' bytes');
	fs.writeFileSync(path, newCompressed);
	console.log('\tSaved to ' + path);

	console.log('Concatenating ' + depsCSS.length + ' CSS files...');

	ncp('external/gmxControls/src/css/img', 'dist/css/img');

	var newSrc = combineFiles(depsCSS),
	    pathPart = 'dist/css/leaflet-geomixer-all',
	    srcPath = pathPart + '.css';

	console.log('\tCSS size: ' + newSrc.length + ' bytes');

	fs.writeFileSync(srcPath, newSrc);
	console.log('\tSaved to ' + srcPath);
};
var gmxDeps = require('./build/deps.js'),
	gulp = require('gulp'),
    path = require('path'),
    ncp = require('ncp').ncp,
	fileExists = require('file-exists'),
	dirExists = require('directory-exists'),
	cp = require('child_process'),
	execSync = cp.execSync,
    UglifyJS = require('uglify-js'),
    uuid = require('node-uuid'),
    fs = require('fs'),
    Handlebars = require('handlebars'),
    concat = require('gulp-concat'),
	root = './',
	external = root + 'external/';

function outBuild(name, js, css) {
	if (js) {
		var buildDate = new Date().toLocaleString(),
			prefix = '(function () {\n\'use strict\';\nvar buildDate = \'' + buildDate + '\';\n',
			postfix = '\n}());\n';

		fs.writeFileSync(name + '-src.js', prefix + js + postfix);
		fs.writeFileSync(name + '.js', prefix + UglifyJS.minify(js, {warnings: true, fromString: true}).code + postfix);
	}
	if (css) {
		fs.writeFileSync(name + '.css', css);
	}
}
gulp.task('gmx-pub', [], function(cb) {
    var apiFiles = gmxDeps.apiFiles,
        buildDate = new Date().toLocaleString(),
        buildUUID = uuid.v4().replace(/-/g, ''),
		newJs = '',
		newCss = '';
		
    fs.mkdir(root + 'dist/', function() {
		var distPath = root + 'dist/';
		apiFiles.forEach(function(it) {
			console.time(it.key);
			var dir = external + it.key,
				mobiles = it.mobiles,
				jake = it.pub.jake,
				jsFiles = it.pub.js || [],
				cssFiles = it.pub.css || [],
				img = it.pub.img;
			
			if (jake && fileExists(dir + '/Jakefile.js')) {
				var fromDir = process.cwd();
				process.chdir(dir);
				execSync((process.platform === 'win32' ? 'npm.cmd' : 'npm') + ' install');
				execSync(jake);
				process.chdir(fromDir);
			}

			jsFiles.forEach(function(name) {
				newJs += fs.readFileSync(dir + '/' + name, 'utf8') + '\n\n';
			});
			cssFiles.forEach(function(name) {
				newCss += fs.readFileSync(dir + '/' + name, 'utf8') + '\n\n';
			});
			if (img) {
				ncp(dir + '/' + img.src, distPath + img.out);
			}
			console.timeEnd(it.key);

			if (mobiles) {
				outBuild(distPath + 'mobiles', newJs, newCss);
			}
		});
		outBuild(distPath + 'geomixer', newJs, newCss);
    });
});

/*
var root = "./",
    commonRoot = root + 'common_components/repo/',
    distDir = root + 'dist/',
	num = 1500,
	depsModules = {
		'Leaflet-0.7.7': {srt: num--},
		'Leaflet.gmxBaseLayersManager': {srt: num--, js: ['gmxBaseLayersManager.js', 'initBaseLayerManager.js']},
		'ssss': {srt: 10}
	};

var addPrefix = function(prefix, array) {
    return array.map(function(elem) {return prefix + elem;});
};

function parsePlugin(it) {
	var fromPath = './' + (dirExists.sync('dist') ? 'dist' : (dirExists.sync('src') ? 'src' : ''));
// console.log(process.cwd(), ' dddddddd ', fromPath, dirExists.sync('src'));
	
	var files = fs.readdirSync(fromPath),
		src = '',
		css = '';

	if (depsModules[it] && depsModules[it].files) {
		depsModules[it].files.forEach(function(name) {
			src += fs.readFileSync(fromPath + '/' + name, 'utf8') + '\n\n';
		});
	} else {
		fs.readdirSync(fromPath).forEach(function(name) {
		// for (var i = 0, len = files.length; i < len; i++) {
			var name = files[i],
				file = fromPath + '/' + name;

console.log(fromPath , ' gggggg ', name);
			if (/-src\.js$/.test(name)) {
				src += fs.readFileSync(file, 'utf8') + '\n\n';
			} else if (/\.css$/.test(name)) {
				css += fs.readFileSync(file, 'utf8') + '\n\n';
			}
		});
	}
	return {
		css: css,
		js: src
	};
}


gulp.task('gmx-pub', [], function(cb) {
    var gmxDeps = require('./build/deps.js'),
        leaflet = 'Leaflet-0.7.7',
        buildDate = new Date().toLocaleString(),
        buildUUID = uuid.v4().replace(/-/g, ''),
		newSrc = '(function () {\
			"use strict";\
			var buildDate = \'' + buildDate + '\';\
		',
		newCss = '';

	var external = root + 'external/',
		submodules = fs.readdirSync(external).sort(function(a, b) {
			var aa = depsModules[a] ? depsModules[a].srt : 0,
				bb = depsModules[b] ? depsModules[b].srt : 0;
			return bb - aa;
		}),
		fromDir = process.cwd();
 console.log(submodules);		

	submodules.forEach(function(it) {
		console.time(it);
		var dir = external + it;
		process.chdir(dir);
		if (fileExists('Jakefile.js')) {
// process.setMaxListeners(0);
			execSync((process.platform === 'win32' ? 'npm.cmd' : 'npm') + ' install');
			execSync('jake build');
		} else {
        // loaderScript = fs.readFileSync(root + '/build/loader.js', {encoding: 'utf8'}),
		
		}
		var content = parsePlugin(it);
		newSrc += content.js;
		newCss += content.css;
		// console.log(process.uptime(), ' Ok ', dir);
		console.timeEnd(it);		
		process.chdir(fromDir);

// console.log(dir, );		
 // path.exists(dir, function(exists) {
    // var message = (exists) ? dir + ': is a directory' : dir + ': is not a directory';
    // console.log(message);
  // });        
		// var stats = fs.statSync(external + it + '/Jakefile.js');
// console.log('dddddddddddd:', stats);
  // console.log(err ? 'no access!' : 'can read/write', external + it + '/Jakefile.js');
// });
		// });
	});
	newSrc += '\n}());\n';
	fs.writeFileSync('dist/geomixer.js', newSrc);
	fs.writeFileSync('dist/css/geomixer.css', newCss);
})

// gulp.task('gmx-pub', ['compile', 'gmx-pub-self']);

var createLoader = function(params, cb) {
    var buildUUID = uuid.v4().replace(/-/g, ''),
        loaderScript = fs.readFileSync(root + '/build/loader.js', {encoding: 'utf8'}),
        loaderTemplate = Handlebars.compile(
            '+function() {' +
                'var buildGUID = "{{{buildUUID}}}";' +
                'var gmxFilesList = {{{jsToLoad}}};' +
                'var thirdpartyList = {{{thirdpartyList}}};' +
                'var cssToLoad = {{{cssToLoad}}};' +
                'var moduleFiles = {{{moduleFiles}}};' +
                '{{{loaderScript}}} ' +
            '}()'
        );
        
    console.log('GUID:', buildUUID);
    
    fs.mkdir(root + 'dist/', function() {
        fs.writeFileSync(root + 'dist/geomixer.js', loaderTemplate({
            buildUUID: buildUUID,
            thirdpartyList: JSON.stringify(params.thirdpartyList),
            jsToLoad:       JSON.stringify(params.jsToLoad),
            cssToLoad:      JSON.stringify(params.cssToLoad),
            moduleFiles:    JSON.stringify(params.moduleFiles),
            loaderScript: loaderScript
        }));
        
        cb();
    });
};
	
gulp.task('gmx-dev', ['gmx-dev-self']);
    
gulp.task('gmx-dev-self', function(cb) {
    var gmxDeps = require('./build/deps.js');
    
    // var gmxAPIRelativePath = 'leaflet/plugins/Leaflet-GeoMixer/src/';
    // var gmxAPIDeps = require(root + 'leaflet/plugins/Leaflet-GeoMixer/build/deps.js').deps.map(function(file) {
        // return gmxAPIRelativePath + file;
    // });
    var gmxAPIRelativePath = 'external/Leaflet-GeoMixer/src/',
        gmxAPIDeps = require(root + 'external/Leaflet-GeoMixer/build/deps.js'),
        gmxAPIJS = addPrefix(gmxAPIRelativePath, gmxAPIDeps.depsJS);
        // gmxAPICSS = addPrefix(gmxAPIRelativePath, gmxAPIDeps.depsCSS);
    
    var gmxControlsRelativePath = 'external/gmxControls/',
        gmxControlsDeps = require(root + 'external/gmxControls/build/deps.js'),
        gmxControlsJS = addPrefix(gmxControlsRelativePath, gmxControlsDeps.depsJS),
        gmxControlsCSS = addPrefix(gmxControlsRelativePath, gmxControlsDeps.depsCSS);
    
    var gmxDrawingRelativePath = 'external/gmxDrawing/',
        gmxDrawingDeps = require(root + 'external/gmxDrawing/build/deps.js'),
        gmxDrawingJS = addPrefix(gmxDrawingRelativePath, gmxDrawingDeps.depsJS),
        gmxDrawingCSS = addPrefix(gmxDrawingRelativePath, gmxDrawingDeps.depsCSS);

    createLoader({
        thirdpartyList: gmxDeps.jsFilesThidparty,
        jsToLoad:       [].concat(gmxAPIJS, gmxControlsJS, gmxDrawingJS, gmxDeps.jsFiles),
        cssToLoad:      [].concat(gmxDeps.cssFiles, gmxControlsCSS, gmxDrawingCSS),
        moduleFiles:    gmxDeps.moduleFiles
    }, cb);
});
*/

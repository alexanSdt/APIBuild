var gmxDeps = require('./build/deps.js'),
	gulp = require('gulp'),
    // path = require('path'),
    ncp = require('ncp').ncp,
	fileExists = require('file-exists'),
	// dirExists = require('directory-exists'),
	cp = require('child_process'),
	execSync = cp.execSync,
    UglifyJS = require('uglify-js'),
    fs = require('fs'),
    // Handlebars = require('handlebars'),
    // concat = require('gulp-concat'),
    uuid = require('node-uuid'),
	buildUUID = uuid.v4().replace(/-/g, ''),
	root = './',
	external = root + 'external/';

function outBuild(name, js, css, type) {
	if (js) {
		var buildDate = new Date().toLocaleString(),
			prefix = '(function () {\n\'use strict\';\nvar buildDate = \'' + buildDate + '\';\nvar buildUUID = \'' + buildUUID + '\';\n',
			postfix = '\n}());\n';

		if (type !== 'dev') {
			fs.writeFileSync(name + '.js', prefix + UglifyJS.minify(js, {warnings: true, fromString: true}).code + postfix);
			type = 'src';
		}
		fs.writeFileSync(name + '-' + type + '.js', prefix + js + postfix);
	}
	if (css) {
		fs.writeFileSync(name + '.css', css);
	}
}
gulp.task('gmx-pub', [], function(cb) {
    var apiFiles = gmxDeps.apiFiles,
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

gulp.task('gmx-dev', function(cb) {
    var apiFiles = gmxDeps.apiFiles,
		filesDev = [],
		filesCss = [];
		
    fs.mkdir(root + 'dist/', function() {
		var distPath = root + 'dist/';
		apiFiles.forEach(function(it) {
			console.time(it.key);
			var dir = external + it.key,
				mobiles = it.mobiles,
				jake = it.pub.jake,
				deps = it.pub.deps || '',
				srcPath = it.pub.srcPath || '',
				jsFiles = it.pub.js || [],
				cssFiles = it.pub.css || [],
				arr = jsFiles.concat(cssFiles),
				img = it.pub.img;
			
			if (deps) {
				var fromDeps = require(dir + '/' + deps);
				arr = (fromDeps.depsCSS || []).concat(fromDeps.depsJS || []);
			}
			arr.forEach(function(name) {
				filesDev.push(dir + '/' + srcPath + name);
			});

		});

		outBuild(distPath + 'geomixer',
			'// files for loader\nvar files = [\n\'' + filesDev.join('\',\n\'') + '\'\n];\n'
			+ fs.readFileSync(root + 'build/devLoader.js', {encoding: 'utf8'})		
		, null, 'dev');
    });
});

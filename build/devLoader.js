	function loadSrcFile(url) {
		return new Promise(function(resolve, reject) {
			var nodeType = url.indexOf('.css') > 0 ? 'link' : 'script',
				node = document.createElement(nodeType);
			node.onerror = function() {
				reject();
				node.parentNode.removeChild(node);
			}
			node.onload = function(e) {
				resolve(e);
				if (nodeType !== 'link') {
					node.parentNode.removeChild(node);
				}
			};
			if (nodeType === 'link') {
				node.setAttribute('rel', 'stylesheet');
				node.setAttribute('type', 'text/css');
				node.setAttribute('href', url);
			} else {
				node.setAttribute('charset', 'UTF-8');
				node.setAttribute('src', url);
			}
			document.getElementsByTagName('head').item(0).appendChild(node);
		});
	}

	function getParams() {
		var scripts = document.getElementsByTagName('script');
		for (var i = 0, len = scripts.length; i < len; i++) {
			var src = scripts[i].src;
			if (src.indexOf('geomixer-dev.js') > -1) {
				var par = {},
					arr = src.split('prefix=');
				if (arr.length > 0) {
					par.prefix = arr[1].split('&')[0];
				}
				arr = src.split('key=');
				if (arr.length > 0) {
					par.key = arr[1].split('&')[0];
				}
				return par;
			}
		}
		return {};
	}

	var param = getParams();

	window.geomixerAPI = new Promise((resolve, reject) => {		// Promise for develop frontend
		// begin load src files
		let results = [],
			chain = Promise.resolve();

		files.forEach(function (file) {
			chain = chain
				.then(() => loadSrcFile(param.prefix + file + '?' + buildUUID))
				.then((result) => {
					results.push(result);
				});
		});

		chain.then(() => {
			console.log('Develop frontend: ' + results.length + ' files');
			console.log('APIkey: ', param.key);
			resolve();
		});
		// end load src files
	})
	.catch(error => {
		console.error('Error: ', error);
	});

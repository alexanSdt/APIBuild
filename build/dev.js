(function() {
    // files for loader
	var files = [];

	function loadJS(url) {
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

	function httpGet(url) {

	  return new Promise(function(resolve, reject) {

		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);

		xhr.onload = function() {
		  if (this.status == 200) {
			resolve(this.response);
		  } else {
			var error = new Error(this.statusText);
			error.code = this.status;
			reject(error);
		  }
		};

		xhr.onerror = function() {
		  reject(new Error("Network Error"));
		};

		xhr.send();
	  });
	}

	function getScriptPath() {
		var scripts = document.getElementsByTagName('script'),
			file = 'dev.js';
		for (var i = 0, len = scripts.length; i < len; i++) {
			var src = scripts[i].src;
			if (src && src.indexOf(file) > 0) {
				return src.split(file)[0];
			}
		}
		return '.';
	}

	var basePath = getScriptPath();


	httpGet(basePath + 'deps.js')
	  .then(
		error => alert(`Rejected: ${error}`),
		response => function(response) {
			console.log(`response:`,  response);
		}
	  );
	  
	// начало цепочки
	let chain = Promise.resolve();

	let results = [];

	// в цикле добавляем задачи в цепочку
	[
		'../examples.css',
		'../../dist/geomixer.css',
		'../../dist/geomixer-src.js?key=U92596WMIH'
	].forEach(function(it) {
	  chain = chain
		.then(() => loadJS(it))
		.then((result) => {
		  results.push(result);
		});
	});

	// в конце — выводим результаты
	chain.then(() => {
	  //alert(results);
	});
})();

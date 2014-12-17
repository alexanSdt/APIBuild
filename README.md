buildAPIV2
==========

API version 2 builder

# Примеры использования Leaflet плагинов
  * [Notable Leaflet Plugins](http://leafletjs.com/plugins.html) - Leaflet плагины.

Пример|Описание|Примечание
------|---------|-----------
[gmxHeatMapWebGL.html](http://originalsin.github.io/buildAPIV2/examples/gmxHeatMapWebGL.html)| [WebGL Heatmap](http://leafletjs.com/plugins.html)| High performance Javascript heatmap plugin using WebGL
[restoreView.html](http://originalsin.github.io/buildAPIV2/examples/restoreView.html)| [Leaflet.RestoreView](https://github.com/makinacorpus/Leaflet.RestoreView)| Stores and restores map view using localStorage.
[testIframe.html](http://kosmosnimki.ru/demo/testIframe.html)| Листание карт|
[testDrawingObjectsListWidget.html](http://originalsin.github.io/buildAPIV2/examples/testDrawingObjectsListWidget.html)|Подключение виджета drawing objects.

Build
------

[NodeJS](http://nodejs.org/) is required to build the plugin.

Install `jake` (globally) and other plugins dependencies:
```
npm install -g jake
npm install
npm install ncp
```

Run the following command to build production version:
```
jake
```

Files `leaflet-geomixer-all-min.js`, `leaflet-geomixer-all-src.js`, `css/leaflet-geomixer-all.css` and dir `css/img` will appear in `dist` forder. Do not commit this files to the repository!

You can use plugin without building including file `build/leaflet-geomixer-all-dev.js`. Note, that this script loads all the sources dynamically and should not be used for production deployment.

List of source files is maintained in file `build/deps.js`. It should be updated properly for correct builds.


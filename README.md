buildAPIV2
==========

API version 2 builder

# Пример сборки плагинов Геомиксера

Build
------

[NodeJS](http://nodejs.org/) is required to build the plugin.

Install `jake` (globally) and other plugins dependencies:
```
npm install -g jake
npm install
npm install ncp
npm install eslint
```

Run the following command to build production version:
```
jake
```

Files `leaflet-geomixer-allmin.js`, `leaflet-geomixer-allsrc.js`, `css/leaflet-geomixer-all.css` and dir `css/img` will appear in `dist` forder. Do not commit this files to the repository!

You can use plugin without building including file `build/leaflet-geomixer-all-dev.js`. Note, that this script loads all the sources dynamically and should not be used for production deployment.

List of source files is maintained in file `build/deps.js`. It should be updated properly for correct builds.


buildAPIV2
==========

API version 2 builder

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

Files `apiv2-min.js`, `apiv2-src.js`, `css/apiv2.css` and dir `css/img` will appear in `dist` forder. Do not commit this files to the repository!

You can use plugin without building including file `build/apiv2-dev.js`. Note, that this script loads all the sources dynamically and should not be used for production deployment.

List of source files is maintained in file `build/deps.js`. It should be updated properly for correct builds.


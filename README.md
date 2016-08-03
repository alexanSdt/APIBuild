APIbuild
==========

API version 3 builder

# Пример сборки плагинов Геомиксера

Build
------

[NodeJS](http://nodejs.org/) is required to build the plugin.

```
prepare_repo.bat - обновление модулей для сборки
gulp gmx-pub - подготовка сборок (режим публикации)
gulp gmx-dev - подготовка сборки (режим разработки)
```

Подготавливаются следующие сборки в папке `dist`.
Сборка общая:
```
geomixer.js - API минимизированный вариант(содержит: Leaflet-0.7.7 + необходимые плагины Geomixer)
geomixer-src.js - API в исходном виде
geomixer-dev.js - загрузчик API для режима разработки
geomixer.css - стилевые таблицы
images - папка иконок Leaflet-0.7.7
img - папка иконок контролов Geomixer
```

Сборка для мобильных устройств:
```
mobiles.js - API-mobiles минимизированный вариант(содержит: Leaflet-0.7.7 + Leaflet-Geomixer)
mobiles-src.js - API-mobiles в исходном виде
mobiles.css - стилевые таблицы
images - папка иконок Leaflet-0.7.7
```

Сборки доступны по адресу:
http://www.kosmosnimki.ru/lib/geomixer/

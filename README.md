buildAPIV3
==========

API version 3 builder

# Пример сборки плагинов Геомиксера

Build
------

[NodeJS](http://nodejs.org/) is required to build the plugin.

```
prepare_repo.bat - обновление модулей для сборки
build_pub.bat - подготовка сборок (режим публикации)
```

Подготавливаются следующие сборки в папке `dist`.
Сборка общая:
```
geomixer.js - API минимизированный вариант(содержит: Leaflet-0.7.7 + необходимые плагины Geomixer)
geomixer-src.js - API в исходном виде
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
http://www.kosmosnimki.ru/apiv3/

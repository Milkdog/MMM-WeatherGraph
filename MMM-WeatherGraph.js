Module.register("MMM-WeatherGraph", {

  defaults: {
    provider: "openweathermap",   // "openweathermap" or "apple"

    // OpenWeatherMap settings
    apiKey: "",
    apiBase: "https://api.openweathermap.org/data/3.0/onecall?",

    // Apple WeatherKit settings
    appleTeamId: "",
    appleServiceId: "",
    appleKeyId: "",
    appleKeyPath: "",
    appleCountryCode: "US",
    timezone: "",

    // General settings
    units: config.units,
    language: config.language,
    time24hr: false,
    updateInterval: 15 * 60 * 1000, // every 15 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0,
    retryDelay: 2500,
    tempDecimalPlaces: 0,
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude:  null,
    longitude: null,

    // Display toggles
    showSummary: true,
    showForecast: true,
    showForecastPrecip: true,
    showGraph: true,
    showNextHourPrecip: true,
    graphHourRange: 48,
    graphLegendFont: '10px Arial',
    showGraphTemp: true,
    graphTempColor: 'white',
    graphTempFont: '10px Arial',
    showGraphWind: true,
    graphWindColor: 'grey',
    graphWindFont: '10px Arial',
    showGraphHumid: false,
    graphHumidColor: '#88CC88',
    graphHumidFont: '10px Arial',
    showGraphCloud: false,
    graphCloudColor: '#dedb49',
    graphCloudFont: '10px Arial',
    showGraphLegend: true,
    showGraphPrecip: true,
    precipitationGraphWidth: 400,
    precipitationGraphHeight: 0,
    showHotColdLines: true,
    showWind: true,
    showTemp: true,
    showSunrise: true,

    // Canonical icon table: condition codes -> weather-icons classes
    iconTable: {
      'Clear':              'wi-day-sunny',
      'ClearNight':         'wi-night-clear',
      'PartlyCloudy':       'wi-day-cloudy',
      'PartlyCloudyNight':  'wi-night-alt-cloudy',
      'Cloudy':             'wi-cloudy',
      'Drizzle':            'wi-sprinkle',
      'Rain':               'wi-rain',
      'Thunderstorms':      'wi-thunderstorm',
      'Snow':               'wi-snow',
      'Foggy':              'wi-fog',
      'Haze':               'wi-fog',
      'Smoky':              'wi-smoke',
      'Windy':              'wi-windy',
    },

    debug: false
  },

  getTranslations: function () {
    return false;
  },

  getScripts: function () {
    return [
      'moment.js'
    ];
  },

  getStyles: function () {
    return ["weather-icons.css", "MMM-WeatherGraph.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null &&
           this.config.longitude == null;
  },

  start: function () {
    Log.info("Starting module: " + this.name);

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function () {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000);
      return;
    }

    if (this.config.data) {
      // debug passthrough: inject raw normalized data
      this.processWeather(this.config.data);
      return;
    }

    this.sendSocketNotification('FETCH_WEATHER', {
      config: this.config
    });
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.current.temp);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  processWeatherError: function (error) {
    if (this.config.debug) {
      console.log('process weather error', error);
    }
    this.scheduleUpdate(this.config.retryDelay);
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
    }
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "WEATHER_DATA") {
      this.processWeather(payload);
    } else if (notification === "WEATHER_ERROR") {
      this.processWeatherError(payload);
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    // Credential validation
    if (this.config.provider === "apple") {
      if (!this.config.appleTeamId || !this.config.appleServiceId || !this.config.appleKeyId || !this.config.appleKeyPath) {
        wrapper.textContent = "Please set appleTeamId, appleServiceId, appleKeyId, and appleKeyPath in the config for module: " + this.name;
        wrapper.className = "dimmed light small";
        return wrapper;
      }
    } else {
      if (this.config.apiKey === "") {
        wrapper.textContent = "Please set the correct OpenWeatherMap.org apiKey in the config for module: " + this.name;
        wrapper.className = "dimmed light small";
        return wrapper;
      }
    }

    if (this.geoLocationLookupFailed) {
      wrapper.textContent = "Geolocation lookup failed, please set latitude and longitude in the config for module: " + this.name;
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.textContent = this.translate('Loading Weather...');
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var currentWeather = this.weatherData.current;
    var hourly         = this.weatherData.hourly;
    var daily          = this.weatherData.daily;

    var timeFormat = "h:mm a";
    if (this.config.time24hr) {
      timeFormat = "HH:mm";
    }

//========== Current large icon & Temp
    var large = document.createElement("div");
    large.className = "large light";

    var iconClass = this.config.iconTable[currentWeather.conditionCode];

    if (this.config.showTemp) {
      var icon = document.createElement("span");
      icon.className = 'big-icon wi ' + iconClass;
      large.appendChild(icon);

      var temperature = document.createElement("span");
      temperature.className = "bright";
      temperature.textContent = " " + this.temp + "\u00B0";
      large.appendChild(temperature);
    }

// ====== wind now
    if (this.config.showWind) {
      var padding = document.createElement("span");
      padding.className = "dim";
      padding.textContent = "    ";
      large.appendChild(padding);

      var windicon = document.createElement("span");
      windicon.className = 'big-icon wi wi-strong-wind xdimmed';
      large.appendChild(windicon);

      var wind = document.createElement("span");
      wind.className = "dim";
      wind.textContent = " " + Math.round(currentWeather.windSpeed) + " ";
      large.appendChild(wind);
    }

//========== sunrise/sunset
    if (this.config.showSunrise) {
      var today    = daily[0];
      var tomorrow = daily[1];
      var now      = Date.now();

      var sunString1, sunString2;
      if (today.sunrise*1000 < now && today.sunset*1000 > now) {
        var sunsetTime = moment.unix(today.sunset).format( timeFormat );
        var sunriseTime = moment.unix(tomorrow.sunrise).format( timeFormat );
        sunString1 = sunsetTime;
        sunString2 = sunriseTime;

        var sunTime = document.createElement("div");
        sunTime.className = "small dimmed summary";

        var sunsetIcon = document.createElement("span");
        sunsetIcon.className = "wi wi-sunset xdimmed";
        sunTime.appendChild(sunsetIcon);
        sunTime.appendChild(document.createTextNode(" " + sunString1 + "  "));

        var sunriseIcon = document.createElement("span");
        sunriseIcon.className = "wi wi-sunrise xdimmed";
        sunTime.appendChild(sunriseIcon);
        sunTime.appendChild(document.createTextNode(" " + sunString2));
      } else {
        var sunriseTime = moment.unix(today.sunrise).format( timeFormat );
        var sunsetTime = moment.unix(tomorrow.sunset).format( timeFormat );
        sunString1 = sunriseTime;
        sunString2 = sunsetTime;

        var sunTime = document.createElement("div");
        sunTime.className = "small dimmed summary";

        var sunriseIcon = document.createElement("span");
        sunriseIcon.className = "wi wi-sunrise xdimmed";
        sunTime.appendChild(sunriseIcon);
        sunTime.appendChild(document.createTextNode(" " + sunString1 + "  "));

        var sunsetIcon = document.createElement("span");
        sunsetIcon.className = "wi wi-sunset xdimmed";
        sunTime.appendChild(sunsetIcon);
        sunTime.appendChild(document.createTextNode(" " + sunString2));
      }

      large.appendChild(sunTime);
    }
    wrapper.appendChild(large);

// =========  summary text
    if (this.config.showSummary) {
      var summary = document.createElement("div");
      var summarySnow = "";
      var summaryRain = "";
      var summaryText = "";
      var precipAmt = 0;

      if (this.config.showForecastPrecip) {
        if (this.config.units == 'metric') {       // Metric (mm/cm)
          if (daily[0].rain) {
            precipAmt = daily[0].rain;
            summaryRain = ', ' + precipAmt.toFixed(1) + 'mm rain';
          }
          if (daily[0].snow) {
            precipAmt = daily[0].snow / 10;
            summarySnow = ', ' + precipAmt.toFixed(1) + 'cm snow';
          }
        } else {                                // Imperial (inches)
          if (daily[0].rain) {
            precipAmt = daily[0].rain / 25.4;
            summaryRain = ', ' + precipAmt.toFixed(1) + '" rain';
          }
          if (daily[0].snow) {
            precipAmt = daily[0].snow / 25.4;
            summarySnow = ', ' + precipAmt.toFixed(1) + '" snow';
          }
        }
      }

      summaryText = currentWeather.description + summaryRain + summarySnow;

      summary.className = "small dimmed summary";
      summary.textContent = summaryText;
      wrapper.appendChild(summary);
    }

// ======== precip graph, next-hour graph, and forecast table
    if (this.config.showGraph) {
      wrapper.appendChild(this.renderPrecipitationGraph());
    }
    if (this.config.showNextHourPrecip && this.weatherData.minutely && this.weatherData.minutely.length > 0) {
      wrapper.appendChild(this.renderNextHourGraph());
    }
    if (this.config.showForecast) {
      wrapper.appendChild(this.renderWeatherForecast());
    }

    return wrapper;
  },

  renderPrecipitationGraph: function () {
    var i;
    var width = this.config.precipitationGraphWidth;

    if (this.config.precipitationGraphHeight) {
      if (this.config.precipitationGraphHeight < 30) {
        var height = 30;
      } else {
        var height = this.config.precipitationGraphHeight;
      }
    } else {
      var height = Math.round(width * 0.3);       // 30% by default
    }


    var element = document.createElement('canvas');
    var graphHours = this.config.graphHourRange;

    if (graphHours < 6) {
      graphHours = 6;
    }
    if (graphHours > 48) {
      graphHours = 48;
    }

    element.className = "precipitation-graph";
    element.width  = width;
    element.height = height;
    var context = element.getContext('2d');
    var stepSize = (width / graphHours);  // horizontal pixels per hour

// ======= shade blocks for daylight hours  (grey=day, black=night)
    var now = new Date();
    now = Math.floor(now / 1000);    // current time in Unix format
    var timeUnilSunrise;
    var timeUnilSunset;
    var sunrisePixels;    // daytime shade box location on graph
    var sunsetPixels;

    context.save();
    for (i = 0; i < 3 && i < this.weatherData.daily.length; i++) {
      timeUnilSunrise = (this.weatherData.daily[i].sunrise - now);
      timeUnilSunset  = (this.weatherData.daily[i].sunset - now);

      if ((timeUnilSunrise < 0) && (i == 0)) {
        timeUnilSunrise = 0;       // sunrise has happened already today
      }
      if ((timeUnilSunset < 0) && (i == 0)) {
        timeUnilSunset = 0;        // sunset has happened already today
      }

      sunrisePixels = (timeUnilSunrise/60/60)*stepSize;
      sunsetPixels  = (timeUnilSunset/60/60)*stepSize;

      context.fillStyle = "#323232";
      context.fillRect(sunrisePixels, 0, (sunsetPixels-sunrisePixels), height);
    }
    context.restore();

// ====== scale graph for units
    if (this.config.units == 'metric') {
      var precipGraphYMin = -15;  // graph -15 to 45 degrees C
      var precipGraphYMax = 45;
    } else {
      var precipGraphYMin = -10;  // graph -10 to 110 degrees F
      var precipGraphYMax = 110;
    }
    var precipGraphYRange = precipGraphYMax-precipGraphYMin;  // degree range
    var precipGraphPixelsPerDegree = height/precipGraphYRange;

// ====== freezing and hot lines
    if (this.config.showHotColdLines) {
      if (this.config.units == 'metric') {
        i = 27;    // Hot line at 27 c
      } else {
        i = 80;    // Hot line at 80 f
      }
      context.save();
      context.beginPath();
      context.setLineDash([5, 10]);
      context.lineWidth = 1;
      context.strokeStyle = 'red';
      context.moveTo(0, height - (i-precipGraphYMin)*precipGraphPixelsPerDegree );
      context.lineTo(width, height - (i-precipGraphYMin)*precipGraphPixelsPerDegree );
      context.stroke();

      if (this.config.units == 'metric') {
        i = 0;    // Freezing line at 0 c
      } else {
        i = 32;   // Freezing line at 32 f
      }
      context.beginPath();
      context.strokeStyle = 'blue';
      context.moveTo(0, height - (i-precipGraphYMin)*precipGraphPixelsPerDegree );
      context.lineTo(width, height - (i-precipGraphYMin)*precipGraphPixelsPerDegree );
      context.stroke();
      context.restore();
    }

// ====== graph of rain / snow
    if (this.config.showGraphPrecip) {
      var data = this.weatherData.hourly;

      context.save();
      context.beginPath();
      context.moveTo(0, height);
      var intensity;
      var RainScale = 0.2;
      for (i = 0; i < data.length; i++) {
        intensity = 0;
        if (data[i].rain > 0) {
          intensity = (data[i].rain * height * RainScale) + 4;
        }
        context.lineTo(i * stepSize, height - intensity);
      }
      context.lineTo(width, height);
      context.closePath();

      context.strokeStyle = 'blue';
      context.stroke();

      context.fillStyle = 'blue';
      context.fill();
      context.restore();

// ====== graph of snow
      context.save();

      context.beginPath();
      context.moveTo(0, height);
      for (i = 0; i < data.length; i++) {
        intensity = 0;
        if (data[i].snow > 0) {
          intensity = (data[i].snow * height * RainScale) + 4;
        }
        context.lineTo(i * stepSize, height - intensity);
      }
      context.lineTo(width, height);
      context.closePath();

      context.strokeStyle = 'white';
      context.stroke();

      context.fillStyle = 'white';
      context.fill();
      context.restore();
    }

// ===== 6hr tick lines
    var tickCount = Math.round(width / (stepSize*6));
    context.save();
    context.beginPath();
    context.strokeStyle = 'grey';
    context.fillStyle = 'grey';
    context.lineWidth = 2;
    for (i = 1; i < tickCount; i++) {
      context.moveTo(i * (stepSize*6), height);
      context.lineTo(i * (stepSize*6), height - 7);
      context.stroke();
    }
    context.restore();

// ========= graph of temp
    if (this.config.showGraphTemp) {
      context.save();
      context.strokeStyle = this.config.graphTempColor;
      context.fillStyle = this.config.graphTempColor;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, height);

      var stepSizeTemp = Math.round(width / (graphHours-1));
      var tempX;
      var tempY;

      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        tempX = i * stepSizeTemp;
        tempY = height - (this.weatherData.hourly[i].temp-precipGraphYMin)*precipGraphPixelsPerDegree;

        context.lineTo( tempX, tempY );
        context.stroke();

        context.beginPath();
        context.arc(tempX, tempY, 1 ,0,2*Math.PI);
        context.stroke();
      }
      context.restore();

      var tempTemp;
      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        if ((i % 2) == 1) {
          tempX = (i * stepSizeTemp) - 5;
          tempY = height - (this.weatherData.hourly[i].temp-precipGraphYMin)*precipGraphPixelsPerDegree-5;
          tempTemp = Math.round( this.weatherData.hourly[i].temp );

          context.beginPath();
          context.font = this.config.graphTempFont;
          context.fillStyle = this.config.graphTempColor;
          context.fillText( tempTemp, tempX, tempY );
          context.stroke();
        }
      }
    }

// ========= graph of wind
    if (this.config.showGraphWind) {
      context.save();
      context.strokeStyle = this.config.graphWindColor;
      context.lineWidth = 1;

      context.beginPath();
      context.moveTo(0, height);

      var stepSizeTemp = Math.round(width / (graphHours-1));
      var tempX;
      var tempY;

      if (this.config.units == 'metric') {
        var windGraphScale = height/18;
      } else {
        var windGraphScale = height/40;
      }

      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        tempX = i * stepSizeTemp;
        tempY = height - ((this.weatherData.hourly[i].windSpeed * windGraphScale) + 5);

        context.lineTo( tempX, tempY );
        context.stroke();

        context.beginPath();
        context.arc(tempX, tempY, 1 ,0,2*Math.PI);
        context.stroke();
      }
      context.restore();

      context.save();
      var tempWind;
      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        if ((i % 2) == 1) {
          tempX = (i * stepSizeTemp) - 5;
          tempY = height - ((this.weatherData.hourly[i].windSpeed * windGraphScale) + 5 + 3);
          tempWind = Math.round( this.weatherData.hourly[i].windSpeed );

          context.beginPath();
          context.font = this.config.graphWindFont;
          context.fillStyle = this.config.graphWindColor;
          context.fillText( tempWind, tempX, tempY );
          context.stroke();
        }
      }
      context.restore();
    }

// ========= graph of Humidity
    if (this.config.showGraphHumid) {
      context.save();
      context.strokeStyle = this.config.graphHumidColor;
      context.lineWidth = 1;

      context.beginPath();
      context.moveTo(0, height);

      var stepSizeTemp = Math.round(width / (graphHours-1));
      var tempX;
      var tempY;

      var humidGraphScale = height/110;

      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        tempX = i * stepSizeTemp;
        tempY = height - ((this.weatherData.hourly[i].humidity * humidGraphScale) + 5);

        context.lineTo( tempX, tempY );
        context.stroke();

        context.beginPath();
        context.arc(tempX, tempY, 1 ,0,2*Math.PI);
        context.stroke();
      }
      context.restore();

      context.save();
      var tempHumid;
      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        if ((i % 2) == 1) {
          tempX = (i * stepSizeTemp) - 5;
          tempY = height - ((this.weatherData.hourly[i].humidity * humidGraphScale) + 5 + 3);
          tempHumid = Math.round( this.weatherData.hourly[i].humidity );

          context.beginPath();
          context.font = this.config.graphHumidFont;
          context.fillStyle = this.config.graphHumidColor;
          context.fillText( tempHumid, tempX, tempY );
          context.stroke();
        }
      }
      context.restore();
    }

// ========= graph of Cloud Cover
    if (this.config.showGraphCloud) {
      context.save();
      context.strokeStyle = this.config.graphCloudColor;
      context.lineWidth = 1;

      context.beginPath();
      context.moveTo(0, height);

      var stepSizeTemp = Math.round(width / (graphHours-1));
      var tempX;
      var tempY;

      var cloudGraphScale = height/110;

      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        tempX = i * stepSizeTemp;
        tempY = height - ((this.weatherData.hourly[i].cloudCover * cloudGraphScale) + 5);

        context.lineTo( tempX, tempY );
        context.stroke();

        context.beginPath();
        context.arc(tempX, tempY, 1 ,0,2*Math.PI);
        context.stroke();
      }
      context.restore();

      context.save();
      var tempCloud;
      for (i = 0; i < graphHours && i < this.weatherData.hourly.length; i++) {
        if ((i % 2) == 1) {
          tempX = (i * stepSizeTemp) - 5;
          tempY = height - ((this.weatherData.hourly[i].cloudCover * cloudGraphScale) + 5 + 3);
          tempCloud = Math.round( this.weatherData.hourly[i].cloudCover );

          context.beginPath();
          context.font = this.config.graphCloudFont;
          context.fillStyle = this.config.graphCloudColor;
          context.fillText( tempCloud, tempX, tempY );
          context.stroke();
        }
      }
      context.restore();
    }


// ====== line legends
    if (this.config.showGraphLegend) {
      context.beginPath();
      context.font = this.config.graphLegendFont;
      var labelHeight = 5;
      if (this.config.showGraphCloud) {
        context.fillStyle = this.config.graphCloudColor;
        context.fillText( "Cloud%", width-30, height-labelHeight );
        labelHeight = labelHeight+10;
      }
      if (this.config.showGraphHumid) {
        context.fillStyle = this.config.graphHumidColor;
        context.fillText( "Humid%", width-30, height-labelHeight );
        labelHeight = labelHeight+10;
      }
      if (this.config.showGraphWind) {
        context.fillStyle = this.config.graphWindColor;
        context.fillText( "Wind", width-30, height-labelHeight );
        labelHeight = labelHeight+10;
      }
      if (this.config.showGraphTemp) {
        context.fillStyle = this.config.graphTempColor;
        context.fillText( "Temp", width-30, height-labelHeight );
        labelHeight = labelHeight+10;
      }
      context.stroke();
    }

    return element;
  },

  renderNextHourGraph: function () {
    var minutely = this.weatherData.minutely;
    var width = this.config.precipitationGraphWidth;
    var height = 40;

    var element = document.createElement('canvas');
    element.className = "next-hour-graph";
    element.width = width;
    element.height = height;
    var context = element.getContext('2d');

    // Find max intensity for scaling
    var maxIntensity = 0;
    for (var i = 0; i < minutely.length; i++) {
      if (minutely[i].precipIntensity > maxIntensity) {
        maxIntensity = minutely[i].precipIntensity;
      }
    }
    // Minimum scale of 2 mm/hr so light rain still looks proportional
    if (maxIntensity < 2) {
      maxIntensity = 2;
    }

    var barWidth = width / minutely.length;

    // Draw precipitation bars
    context.save();
    for (var j = 0; j < minutely.length; j++) {
      var intensity = minutely[j].precipIntensity;
      if (intensity > 0) {
        var barHeight = (intensity / maxIntensity) * (height - 12);
        context.fillStyle = 'rgba(100, 180, 255, 0.7)';
        context.fillRect(j * barWidth, height - barHeight, barWidth - 0.5, barHeight);
      }
    }
    context.restore();

    // Draw time markers: 15min, 30min, 45min
    context.save();
    context.strokeStyle = 'grey';
    context.fillStyle = 'grey';
    context.font = '8px Arial';
    context.lineWidth = 1;
    var markers = [15, 30, 45];
    for (var m = 0; m < markers.length; m++) {
      var x = (markers[m] / 60) * width;
      context.beginPath();
      context.moveTo(x, height);
      context.lineTo(x, height - 5);
      context.stroke();
      context.fillText(markers[m] + "m", x - 6, height - 6);
    }
    context.restore();

    // Label
    context.save();
    context.font = '8px Arial';
    context.fillStyle = 'rgba(100, 180, 255, 0.8)';
    context.fillText("Next Hour", 2, 9);
    context.restore();

    return element;
  },

  getDayFromTime: function (time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  renderForecastRow: function (data, min, max) {
    var total = max - min;
    var interval = 100 / total;
    var rowMinTemp = this.roundTemp(data.tempMin);
    var rowMaxTemp = this.roundTemp(data.tempMax);

    var row = document.createElement("tr");
    row.className = "forecast-row";

    var dayTextSpan = document.createElement("span");
    dayTextSpan.className = "forecast-day";
    dayTextSpan.textContent = this.getDayFromTime(data.time);

    var iconClass = this.config.iconTable[data.conditionCode];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;

    var forecastBar = document.createElement("div");
    forecastBar.className = "forecast-bar";

    var minTemp = document.createElement("span");
    minTemp.textContent = rowMinTemp + "\u00B0";
    minTemp.className = "temp min-temp";

    var maxTemp = document.createElement("span");
    maxTemp.textContent = rowMaxTemp + "\u00B0";
    maxTemp.className = "temp max-temp";

    var bar = document.createElement("span");
    bar.className = "bar";
    bar.textContent = "\u00A0";
    var barWidth = Math.round(interval * (rowMaxTemp - rowMinTemp));
    bar.style.width = barWidth + '%';

    var leftSpacer = document.createElement("span");
    leftSpacer.style.width = (interval * (rowMinTemp - min)) + "%";
    var rightSpacer = document.createElement("span");
    rightSpacer.style.width = (interval * (max - rowMaxTemp)) + "%";

    var dayPrecip = document.createElement("span");
    dayPrecip.className = "forecast-day";
    var precipAmt = 0;

    if (this.config.showForecastPrecip) {
      if (this.config.units == 'metric') {       // Metric (mm/cm)
        if (data.snow) {
          precipAmt = data.snow / 10;
          dayPrecip.textContent = precipAmt.toFixed(1) + 'cm';
        } else if (data.rain) {
          precipAmt = data.rain;
          dayPrecip.textContent = precipAmt.toFixed(1) + 'mm';
        } else {
          dayPrecip.textContent = '     ';
        }
      } else {                                 // Imperial (inches)
        if (data.snow) {
          precipAmt = data.snow / 25.4;
          dayPrecip.textContent = precipAmt.toFixed(1) + '"';
        } else if (data.rain) {
          precipAmt = data.rain / 25.4;
          dayPrecip.textContent = precipAmt.toFixed(1) + '"';
        } else {
          dayPrecip.textContent = '     ';
        }
      }
    }
    forecastBar.appendChild( dayPrecip );

    forecastBar.appendChild(leftSpacer);
    forecastBar.appendChild(minTemp);
    forecastBar.appendChild(bar);
    forecastBar.appendChild(maxTemp);
    forecastBar.appendChild(rightSpacer);

    var forecastBarWrapper = document.createElement("td");
    forecastBarWrapper.appendChild(forecastBar);

    row.appendChild(dayTextSpan);
    row.appendChild(icon);
    row.appendChild(forecastBarWrapper);

    return row;
  },

  renderWeatherForecast: function () {
    var numDays =  7;
    var i;

    var filteredDays =
      this.weatherData.daily.filter( function(d, i) { return (i < numDays); });

    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      min = Math.min(min, day.tempMin);
      max = Math.max(max, day.tempMax);
    }
    min = Math.round(min);
    max = Math.round(max);

    var display = document.createElement("table");
    display.className = "forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max);
      display.appendChild(row);
    }
    return display;
  },

  getLocation: function () {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function (location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude  = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function (error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

// Round the temperature based on tempDecimalPlaces
  roundTemp: function (temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp  = Math.round( temp );
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});

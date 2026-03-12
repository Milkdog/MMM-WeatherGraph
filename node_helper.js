var NodeHelper = require("node_helper");
var owm = require("./providers/owm");
var weatherkit = require("./providers/weatherkit");
var Log = require("logger");

module.exports = NodeHelper.create({
  start: function () {
    Log.log("Starting node helper for: MMM-WeatherGraph");
    this.weatherKitTokenCache = { token: null, expiresAt: 0 };
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "FETCH_WEATHER") {
      this.fetchWeather(payload.config);
    }
  },

  fetchWeather: function (config) {
    var self = this;

    if (config.provider === "apple") {
      this.fetchApple(config);
    } else {
      this.fetchOWM(config);
    }
  },

  fetchOWM: function (config) {
    var self = this;
    var url = owm.buildUrl(config);

    if (config.debug) {
      Log.log("[MMM-WeatherGraph] OWM URL: " + url);
    }

    owm.fetchData(url).then(function (raw) {
      var normalized = owm.normalize(raw, config);
      self.sendSocketNotification("WEATHER_DATA", normalized);
    }).catch(function (err) {
      Log.error("[MMM-WeatherGraph] OWM fetch error: " + err.message);
      self.sendSocketNotification("WEATHER_ERROR", { message: err.message });
    });
  },

  fetchApple: function (config) {
    var self = this;

    try {
      var token = weatherkit.generateToken(config, this.weatherKitTokenCache);
      var url = weatherkit.buildUrl(config);

      if (config.debug) {
        Log.log("[MMM-WeatherGraph] WeatherKit URL: " + url);
      }

      weatherkit.fetchData(url, token).then(function (raw) {
        var normalized = weatherkit.normalize(raw, config);
        self.sendSocketNotification("WEATHER_DATA", normalized);
      }).catch(function (err) {
        Log.error("[MMM-WeatherGraph] WeatherKit fetch error: " + err.message);
        // Invalidate token on auth errors
        if (err.message && err.message.indexOf("auth error") !== -1) {
          self.weatherKitTokenCache = { token: null, expiresAt: 0 };
        }
        self.sendSocketNotification("WEATHER_ERROR", { message: err.message });
      });
    } catch (err) {
      Log.error("[MMM-WeatherGraph] WeatherKit token error: " + err.message);
      self.sendSocketNotification("WEATHER_ERROR", { message: err.message });
    }
  },
});

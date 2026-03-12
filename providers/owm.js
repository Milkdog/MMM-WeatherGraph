const https = require("https");
const http = require("http");

// Map OWM weather[0].main to canonical condition codes
const conditionMap = {
  Clear: "Clear",
  Clouds: "Cloudy",
  Drizzle: "Drizzle",
  Rain: "Rain",
  Thunderstorm: "Thunderstorms",
  Snow: "Snow",
  Mist: "Foggy",
  Smoke: "Smoky",
  Haze: "Haze",
  Dust: "Haze",
  Fog: "Foggy",
  Sand: "Haze",
  Ash: "Haze",
  Squall: "Windy",
  Tornado: "Windy",
};

function buildUrl(config) {
  var unitTable = {
    default: "imperial",
    metric: "metric",
    imperial: "imperial",
  };
  var units = unitTable[config.units] || "imperial";
  return (
    (config.apiBase || "https://api.openweathermap.org/data/3.0/onecall?") +
    "appid=" + config.apiKey +
    "&lat=" + config.latitude +
    "&lon=" + config.longitude +
    "&units=" + units +
    "&lang=" + (config.language || "en")
  );
}

function fetchData(url) {
  return new Promise(function (resolve, reject) {
    var mod = url.startsWith("https") ? https : http;
    mod.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("OWM API returned status " + res.statusCode + ": " + data));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse OWM response: " + e.message));
        }
      });
    }).on("error", function (err) {
      reject(err);
    });
  });
}

function mapCondition(owmMain) {
  return conditionMap[owmMain] || "Cloudy";
}

function humanize(conditionCode) {
  // Convert camelCase/PascalCase to spaced lowercase
  return conditionCode.replace(/([A-Z])/g, " $1").trim().toLowerCase();
}

function normalize(raw, config) {
  var current = raw.current || {};
  var currentWeather = (current.weather && current.weather[0]) || {};

  var normalized = {
    current: {
      temp: current.temp || 0,
      windSpeed: current.wind_speed || 0,
      humidity: current.humidity || 0,
      cloudCover: current.clouds || 0,
      conditionCode: mapCondition(currentWeather.main),
      description: currentWeather.description || "",
    },
    hourly: [],
    daily: [],
    minutely: [],
  };

  // Hourly - up to 48 entries
  var hourlyData = (raw.hourly || []).slice(0, 48);
  for (var i = 0; i < hourlyData.length; i++) {
    var h = hourlyData[i];
    var rain = 0;
    var snow = 0;
    if (h.rain && h.rain["1h"]) {
      rain = h.rain["1h"];
    }
    if (h.snow && h.snow["1h"]) {
      snow = h.snow["1h"];
    }
    normalized.hourly.push({
      time: h.dt || 0,
      temp: h.temp || 0,
      windSpeed: h.wind_speed || 0,
      humidity: h.humidity || 0,
      cloudCover: h.clouds || 0,
      rain: rain,
      snow: snow,
    });
  }

  // Daily - up to 7 entries
  var dailyData = (raw.daily || []).slice(0, 7);
  for (var j = 0; j < dailyData.length; j++) {
    var d = dailyData[j];
    var dayWeather = (d.weather && d.weather[0]) || {};
    normalized.daily.push({
      time: d.dt || 0,
      conditionCode: mapCondition(dayWeather.main),
      tempMin: d.temp ? d.temp.min : 0,
      tempMax: d.temp ? d.temp.max : 0,
      sunrise: d.sunrise || 0,
      sunset: d.sunset || 0,
      rain: d.rain || 0,
      snow: d.snow || 0,
    });
  }

  // Minutely - OWM provides dt + precipitation (mm)
  var minutelyData = raw.minutely || [];
  for (var k = 0; k < minutelyData.length; k++) {
    var m = minutelyData[k];
    normalized.minutely.push({
      time: m.dt || 0,
      precipIntensity: m.precipitation || 0,
    });
  }

  return normalized;
}

module.exports = {
  buildUrl: buildUrl,
  fetchData: fetchData,
  normalize: normalize,
};

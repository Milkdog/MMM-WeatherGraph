const https = require("https");
const fs = require("fs");
const jwt = require("jsonwebtoken");

// Map WeatherKit conditionCode to canonical codes
var conditionMap = {
  Clear: "Clear",
  MostlyClear: "Clear",
  PartlyCloudy: "PartlyCloudy",
  MostlyCloudy: "Cloudy",
  Cloudy: "Cloudy",
  Overcast: "Cloudy",
  Foggy: "Foggy",
  Haze: "Haze",
  Smoky: "Smoky",
  Breezy: "Windy",
  Windy: "Windy",
  Drizzle: "Drizzle",
  FreezingDrizzle: "Drizzle",
  Rain: "Rain",
  HeavyRain: "Rain",
  FreezingRain: "Rain",
  IsolatedThunderstorms: "Thunderstorms",
  ScatteredThunderstorms: "Thunderstorms",
  StrongStorms: "Thunderstorms",
  Thunderstorms: "Thunderstorms",
  Flurries: "Snow",
  Snow: "Snow",
  HeavySnow: "Snow",
  BlowingSnow: "Snow",
  Blizzard: "Snow",
  Sleet: "Snow",
  WintryMix: "Snow",
  Hail: "Snow",
  Hot: "Clear",
  Frigid: "Clear",
  BlowingDust: "Haze",
  TropicalStorm: "Rain",
  Hurricane: "Rain",
  SunShowers: "Rain",
  SunFlurries: "Snow",
};

// Human-readable descriptions
var descriptionMap = {
  Clear: "clear",
  MostlyClear: "mostly clear",
  PartlyCloudy: "partly cloudy",
  MostlyCloudy: "mostly cloudy",
  Cloudy: "cloudy",
  Overcast: "overcast",
  Foggy: "foggy",
  Haze: "haze",
  Smoky: "smoky",
  Breezy: "breezy",
  Windy: "windy",
  Drizzle: "drizzle",
  FreezingDrizzle: "freezing drizzle",
  Rain: "rain",
  HeavyRain: "heavy rain",
  FreezingRain: "freezing rain",
  IsolatedThunderstorms: "isolated thunderstorms",
  ScatteredThunderstorms: "scattered thunderstorms",
  StrongStorms: "strong storms",
  Thunderstorms: "thunderstorms",
  Flurries: "flurries",
  Snow: "snow",
  HeavySnow: "heavy snow",
  BlowingSnow: "blowing snow",
  Blizzard: "blizzard",
  Sleet: "sleet",
  WintryMix: "wintry mix",
  Hail: "hail",
  Hot: "hot",
  Frigid: "frigid",
  BlowingDust: "blowing dust",
  TropicalStorm: "tropical storm",
  Hurricane: "hurricane",
  SunShowers: "sun showers",
  SunFlurries: "sun flurries",
};

function generateToken(config, tokenCache) {
  var now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 60s buffer)
  if (tokenCache.token && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;
  }

  var privateKey = fs.readFileSync(config.appleKeyPath, "utf8");

  var payload = {
    iss: config.appleTeamId,
    sub: config.appleServiceId,
    iat: now,
    exp: now + 1800, // 30 minutes
  };

  var token = jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      typ: "JWT",
      kid: config.appleKeyId,
      id: config.appleTeamId + "." + config.appleServiceId,
    },
  });

  tokenCache.token = token;
  tokenCache.expiresAt = now + 1800;

  return token;
}

function buildUrl(config) {
  var lang = (config.language || "en").split("-")[0];
  var base =
    "https://weatherkit.apple.com/api/v1/weather/" +
    lang + "/" +
    config.latitude + "/" +
    config.longitude;

  var params = [
    "dataSets=currentWeather,forecastDaily,forecastHourly,forecastNextHour",
    "countryCode=" + (config.appleCountryCode || "US"),
  ];

  if (config.timezone) {
    params.push("timezone=" + config.timezone);
  }

  return base + "?" + params.join("&");
}

function fetchData(url, token) {
  return new Promise(function (resolve, reject) {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    };

    https.get(options, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          // Invalidate token on auth errors
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error("WeatherKit auth error (" + res.statusCode + "): check your Apple credentials. " + data));
          } else {
            reject(new Error("WeatherKit API returned status " + res.statusCode + ": " + data));
          }
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse WeatherKit response: " + e.message));
        }
      });
    }).on("error", function (err) {
      reject(err);
    });
  });
}

function isoToUnix(isoString) {
  if (!isoString) return 0;
  return Math.floor(new Date(isoString).getTime() / 1000);
}

function celsiusToFahrenheit(c) {
  return (c * 9) / 5 + 32;
}

function kmhToMph(kmh) {
  return kmh * 0.621371;
}

function kmhToMs(kmh) {
  return kmh / 3.6;
}

function isSnowType(precipType) {
  return precipType === "snow" || precipType === "sleet" || precipType === "hail" || precipType === "mixed";
}

function normalize(raw, config) {
  var isImperial = config.units === "imperial";
  var cw = raw.currentWeather || {};

  function convertTemp(c) {
    return isImperial ? celsiusToFahrenheit(c) : c;
  }

  function convertWind(kmh) {
    return isImperial ? kmhToMph(kmh) : kmhToMs(kmh);
  }

  var normalized = {
    current: {
      temp: convertTemp(cw.temperature || 0),
      windSpeed: convertWind(cw.windSpeed || 0),
      humidity: Math.round((cw.humidity || 0) * 100),
      cloudCover: Math.round((cw.cloudCover || 0) * 100),
      conditionCode: conditionMap[cw.conditionCode] || "Cloudy",
      description: descriptionMap[cw.conditionCode] || cw.conditionCode || "",
    },
    hourly: [],
    daily: [],
    minutely: [],
  };

  // Hourly forecasts - up to 48
  var hours = (raw.forecastHourly && raw.forecastHourly.hours) || [];
  var hourCount = Math.min(hours.length, 48);
  for (var i = 0; i < hourCount; i++) {
    var h = hours[i];
    var rain = 0;
    var snow = 0;
    var intensity = h.precipitationIntensity || 0;
    if (intensity > 0) {
      if (isSnowType(h.precipitationType)) {
        snow = intensity;
      } else {
        rain = intensity;
      }
    }

    normalized.hourly.push({
      time: isoToUnix(h.forecastStart),
      temp: convertTemp(h.temperature || 0),
      windSpeed: convertWind(h.windSpeed || 0),
      humidity: Math.round((h.humidity || 0) * 100),
      cloudCover: Math.round((h.cloudCover || 0) * 100),
      rain: rain,
      snow: snow,
    });
  }

  // Daily forecasts - up to 7
  var days = (raw.forecastDaily && raw.forecastDaily.days) || [];
  var dayCount = Math.min(days.length, 7);
  for (var j = 0; j < dayCount; j++) {
    var d = days[j];
    var dayRain = 0;
    var daySnow = 0;

    // Sum daytime + overnight precipitation
    var parts = [d.daytimeForecast, d.overnightForecast];
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      if (part && part.precipitationAmount) {
        if (isSnowType(part.precipitationType)) {
          daySnow += part.precipitationAmount;
        } else {
          dayRain += part.precipitationAmount;
        }
      }
    }

    normalized.daily.push({
      time: isoToUnix(d.forecastStart),
      conditionCode: conditionMap[d.conditionCode] || "Cloudy",
      tempMin: convertTemp(d.temperatureMin || 0),
      tempMax: convertTemp(d.temperatureMax || 0),
      sunrise: isoToUnix(d.sunrise),
      sunset: isoToUnix(d.sunset),
      rain: dayRain,   // always in mm
      snow: daySnow,   // always in mm
    });
  }

  // Next-hour minutely precipitation
  var minutes = (raw.forecastNextHour && raw.forecastNextHour.minutes) || [];
  for (var k = 0; k < minutes.length; k++) {
    var m = minutes[k];
    normalized.minutely.push({
      time: isoToUnix(m.startTime),
      precipIntensity: m.precipitationIntensity || 0,
    });
  }

  return normalized;
}

module.exports = {
  generateToken: generateToken,
  buildUrl: buildUrl,
  fetchData: fetchData,
  normalize: normalize,
};

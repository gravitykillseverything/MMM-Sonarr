const NodeHelper = require("node_helper");
const https = require("https");
const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");


module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
        this.started = false;
    },

    socketNotificationReceived: function(notification, payload) {
        console.log(`${this.name}: Received notification: ${notification}`);
        
        if (notification === "START_SONARR") {
            console.log(`${this.name}: Starting Sonarr data fetch with config:`, payload);
            this.config = payload;
            this.started = true;
            this.getUpcoming();
            this.getHistory();
            this.loadTranslationFile();

        }
    },

    loadTranslationFile: function() {
        console.log(`${this.name}: Translation load started`);
        try {
            const translationDir = path.join('modules', 'MMM-Sonarr', "translations");
            const filePath = path.join(translationDir, `${this.config.language}.json`);
            
            console.log(`${this.name}: Looking for translation file at:`, filePath);

            if (!fs.existsSync(filePath)) {
                throw new Error(`Translation file not found for language: ${this.config.language}`);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const translation = JSON.parse(content);
            
            console.log(`${this.name}: Translation loaded successfully:`, translation);
            this.sendSocketNotification("SONARR_TRANSLATION", translation);
        } catch(err) {
            console.error(`${this.name}: Error loading translation:`, err.message);
            console.log(`${this.name}: Sending default translations`);
            this.sendSocketNotification("SONARR_TRANSLATION", {
                upcoming: "Upcoming Episodes",
                recent: "Recent Episodes"
            });
        }
    },

    getUpcoming: function() {
        console.log(`${this.name}: Fetching upcoming episodes`);
        var apiUrl = `${this.config.baseUrl}/api/v3/calendar`;
        var currentDate = new Date();
        var futureDate = new Date(currentDate.getTime() + 24 * 24 * 60 * 60 * 1000);
    
        var params = new URLSearchParams({
            start: currentDate.toISOString(),
            end: futureDate.toISOString(),
            includeSeries: "true",
            includeEpisodeFile: "false"
        });
    
        this.sendRequest(apiUrl, params, (response) => {
            if (!Array.isArray(response)) {
                console.error(`${this.name}: Unexpected response format from Sonarr API`);
                return;
            }
            console.log(`${this.name}: Sending upcoming data to module`);
            this.sendSocketNotification("SONARR_UPCOMING", response);
        });
    },

    getHistory: function() {
        console.log(`${this.name}: Fetching history`);
        var apiUrl = `${this.config.baseUrl}/api/v3/history`;
        var params = new URLSearchParams({
            page: 1,
            pageSize: 50,
            sortKey: "date",
            sortDirection: "descending",
            includeSeries: true,
            includeEpisode: true,
            eventType: 1,
        });

        this.sendRequest(apiUrl, params, (response) => {
            console.log(`${this.name}: Sending history data to module`);
            if (response && response.records) {
                this.sendSocketNotification("SONARR_HISTORY", response.records);
            } else {
                console.error(`${this.name}: Invalid history response:`, response);
            }
        });
    },

    sendRequest: function(apiUrl, params, callback) {
        var fullUrl = `${apiUrl}?${params.toString()}`;
        console.log(`${this.name}: Sending request to:`, fullUrl);
        
        var parsedUrl = url.parse(fullUrl);
        
        var options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                "X-Api-Key": this.config.apiKey,
            },
        };

        var protocol = parsedUrl.protocol === 'https:' ? https : http;

        var req = protocol.request(options, (res) => {
            var data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    console.log(`${this.name}: Response received, parsing JSON`);
                    var jsonData = JSON.parse(data);
                    callback(jsonData);
                } catch (error) {
                    console.error(`${this.name}: Error parsing JSON:`, error);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`${this.name}: Error making request:`, error);
        });

        req.end();
    },
});

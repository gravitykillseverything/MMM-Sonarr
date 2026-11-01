const NodeHelper = require("node_helper");
const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");


const REQUEST_TIMEOUT = 10 * 1000;

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
        this.started = false;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "START_SONARR") {
            this.config = payload;
            this.started = true;
            this.getUpcoming();
            this.getHistory();
            this.loadTranslationFile();
            this.scheduleUpdate();
        }
    },

    // One timer for the whole server: a page reload or a second browser restarts it instead of adding another.
    scheduleUpdate: function() {
        clearInterval(this.updateTimer);
        this.updateTimer = setInterval(() => {
            this.getUpcoming();
            this.getHistory();
        }, this.config.updateInterval);
    },

    loadTranslationFile: function() {
        try {
            const translationDir = path.join('modules', 'MMM-Sonarr', "translations");
            const filePath = path.join(translationDir, `${this.config.language}.json`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`Translation file not found for language: ${this.config.language}`);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const translation = JSON.parse(content);
            
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
        var apiUrl = `${this.config.baseUrl}/api/v3/calendar`;
        var currentDate = new Date();
        var futureDate = new Date(currentDate.getTime() + 24 * 24 * 60 * 60 * 1000);
    
        var params = new URLSearchParams({
            start: currentDate.toISOString(),
            end: futureDate.toISOString(),
            includeSeries: "true",
            includeEpisodeFile: "false"
        });
    
        this.sendRequest("upcoming", apiUrl, params, (response) => {
            if (!Array.isArray(response)) throw new Error("calendar is not a list");
            this.sendSocketNotification("SONARR_UPCOMING", response);
        });
    },

    getHistory: function() {
        var apiUrl = `${this.config.baseUrl}/api/v3/history`;
        var params = new URLSearchParams({
            page: 1,
            pageSize: 50,
            sortKey: "date",
            sortDirection: "descending",
            includeSeries: true,
            includeEpisode: true,
            eventType: 3, // downloadFolderImported (1 is grabbed)
        });

        this.sendRequest("recent", apiUrl, params, (response) => {
            if (!response || !Array.isArray(response.records)) throw new Error("history has no records");
            this.sendSocketNotification("SONARR_HISTORY", response.records);
        });
    },

    // Calls the API. A good reply goes to onData; any failure (no connection, timeout, HTTP error, a reply
    // onData can't use) is logged and shown on the mirror for this section until it loads again.
    sendRequest: function(section, apiUrl, params, onData) {
        var parsedUrl = new URL(`${apiUrl}?${params.toString()}`);
        var protocol = parsedUrl.protocol === 'https:' ? https : http;
        let finished = false;
        var fail = (message, detail) => {
            if (finished) return;
            finished = true;
            this.sendError(section, message, detail);
        };

        var options = {
            method: 'GET',
            headers: {
                "X-Api-Key": this.config.apiKey,
            },
        };

        var req = protocol.request(parsedUrl, options, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                fail(res.statusCode === 401 ? "API key rejected (401)" : `HTTP ${res.statusCode}`);
                return;
            }
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('error', (error) => fail("connection lost", error.message));
            res.on('end', () => {
                if (finished) return;
                finished = true;
                try {
                    onData(JSON.parse(data));
                } catch (error) {
                    this.sendError(section, "unexpected reply", error.message);
                }
            });
        });

        req.setTimeout(REQUEST_TIMEOUT, () => {
            fail(`no answer after ${REQUEST_TIMEOUT / 1000}s`);
            req.destroy();
        });
        req.on('error', (error) => fail(`can't connect (${error.code || error.message})`));
        req.end();
    },

    sendError: function(section, message, detail) {
        console.error(`${this.name}: ${section}: ${message}${detail ? ` (${detail})` : ""}`);
        this.sendSocketNotification("SONARR_ERROR", { section: section, message: `Sonarr: ${message}` });
    },
});

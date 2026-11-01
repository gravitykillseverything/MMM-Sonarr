
Module.register("MMM-Sonarr", {
    defaults: {
        apiKey: "",
        baseUrl: "http://localhost:8989",
        upcomingLimit: 5,
        historyLimit: 5,
        updateInterval: 1 * 60 * 1000, // 1 minute
        language: "en",
    },

    start: function() {
        this.loaded = false;
        this.upcoming = [];
        this.history = [];

        this.translations = [];
        this.errors = {};

        this.sendSocketNotification("START_SONARR", this.config);
    },

    getStyles: function() {
        return ["MMM-Sonarr.css"];
    },

    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "sonarr-wrapper";

        if (!this.loaded) {
            const loading = document.createElement("div");
            loading.textContent = "Loading...";
            wrapper.appendChild(loading);
            return wrapper;
        }

        if (this.config.upcomingLimit > 0) {
            const upcomingSection = this.createSection("upcoming", this.upcoming, this.config.upcomingLimit);
            wrapper.appendChild(upcomingSection);
        }

        if (this.config.historyLimit > 0) {
            const historySection = this.createSection("recent", this.history, this.config.historyLimit);
            wrapper.appendChild(historySection);
        }

        // A failed fetch shows one dim line under the first heading; the lists that last loaded stay.
        const messages = [...new Set(Object.values(this.errors))];
        if (messages.length > 0) {
            const error = document.createElement("div");
            error.className = "sonarr-error dimmed";
            error.textContent = messages.join(" · ");
            const firstHeader = wrapper.querySelector("h2");
            if (firstHeader) {
                firstHeader.after(error);
            } else {
                wrapper.appendChild(error);
            }
        }

        return wrapper;
    },

    createSection: function(section_type, data, limit) {
        const section = document.createElement("div");
        section.className = "sonarr-section";

        const header = document.createElement("h2");
        header.textContent = this.translations[section_type];
        section.appendChild(header);

        const list = document.createElement("ul");
        
        if (!Array.isArray(data)) {
            Log.warn(`MMM-Sonarr: Data for ${section_type} is not an array:`, data);
            return section;
        }
        
        const uniqueEntries = new Set();
        
        data.forEach(item => {
            try {
                let entryText;
                if (section_type === "upcoming") {
                    entryText = `${item.series.title} - ${item.seasonNumber}x${item.episodeNumber}`;
                } else {
                    entryText = `${item.series.title} - ${item.episode.seasonNumber}x${item.episode.episodeNumber}`;
                }
                
                if (!uniqueEntries.has(entryText) && uniqueEntries.size < limit) {
                    uniqueEntries.add(entryText);
                    const listItem = document.createElement("li");
                    listItem.textContent = entryText;
                    list.appendChild(listItem);
                }
            } catch (error) {
                Log.error("MMM-Sonarr: Error creating list item:", error);
            }
        });

        section.appendChild(list);
        return section;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SONARR_UPCOMING") {
            this.upcoming = payload;
            delete this.errors.upcoming;
            this.loaded = true;
            this.updateDom();
        } else if (notification === "SONARR_HISTORY") {
            this.history = payload;
            delete this.errors.recent;
            this.loaded = true;
            this.updateDom();
        } else if (notification === "SONARR_TRANSLATION") {
            this.translations = payload;
            this.loaded = true;
            this.updateDom();
        } else if (notification === "SONARR_ERROR") {
            this.errors[payload.section] = payload.message;
            this.loaded = true;
            this.updateDom();
        }
    },
});
Module.register("MMM-Sonarr", {
    defaults: {
        apiKey: "",
        baseUrl: "http://localhost:8989",
        upcomingLimit: 5,
        historyLimit: 5,
        updateInterval: 1 * 60 * 1000, // 1 minute
        language: "en" // Language configuration (default: English)
    },

    start: function() {
        this.upcoming = [];
        this.history = [];
        this.sendSocketNotification("START_SONARR", this.config);
    },

    getStyles: function() {
        return ["MMM-Sonarr.css"];
    },

    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "sonarr-wrapper";

        // Translate section headers based on language
        const translations = {
            en: {
                upcoming: "Upcoming Shows",
                history: "Recently Downloaded"
            },
            no: {
                upcoming: "Upcoming Shows",
                history: "Recently Downloaded"
            }
        };
        const currentLang = translations[this.config.language || "en"];

        if (this.config.upcomingLimit > 0) {
            const upcomingSection = this.createSection(currentLang.upcoming, this.upcoming, this.config.upcomingLimit, "Upcoming Shows");
            wrapper.appendChild(upcomingSection);
        }

        if (this.config.historyLimit > 0) {
            const historySection = this.createSection(currentLang.history, this.history, this.config.historyLimit, "Recently Downloaded");
            wrapper.appendChild(historySection);
        }

        return wrapper;
    },

    createSection: function(displayTitle, data, limit, apiTitle) {
        const section = document.createElement("div");
        section.className = "sonarr-section";

        const header = document.createElement("h2");
        header.textContent = displayTitle; // Display the translated title
        section.appendChild(header);

        const list = document.createElement("ul");
        
        // Create a Set to store unique entries
        const uniqueEntries = new Set();
        
        data.forEach(item => {
            let entryText;
            if (apiTitle === "Upcoming Shows") { // Use original API title for logic
                entryText = `${item.series.title} - ${item.seasonNumber}x${item.episodeNumber}`;
            } else {
                entryText = `${item.series.title} - ${item.episode.seasonNumber}x${item.episode.episodeNumber}`;
            }
            
            // Only add the entry if it's not already in the Set
            if (!uniqueEntries.has(entryText) && uniqueEntries.size < limit) {
                uniqueEntries.add(entryText);
                const listItem = document.createElement("li");
                listItem.textContent = entryText;
                list.appendChild(listItem);
            }
        });

        section.appendChild(list);
        return section;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SONARR_UPCOMING") {
            this.upcoming = payload;
            this.updateDom();
        } else if (notification === "SONARR_HISTORY") {
            this.history = payload;
            this.updateDom();
        }
    },
});

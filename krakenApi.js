const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

class KrakenFuturesApi {
    constructor(apiKey, apiSecret, baseUrl = 'https://futures.kraken.com') {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = baseUrl;
        this.nonceCounter = 0;
    }

    createNonce() {
        if (this.nonceCounter > 9999) this.nonceCounter = 0;
        return Date.now() + ('0000' + this.nonceCounter++).slice(-5);
    }

    signRequest(endpoint, nonce, postData = '') {
        const path = endpoint.startsWith('/derivatives') ? endpoint.slice('/derivatives'.length) : endpoint;
        const message = postData + nonce + path;
        const hash = crypto.createHash('sha256').update(message).digest();
        const secretDecoded = Buffer.from(this.apiSecret, 'base64');
        const hmac = crypto.createHmac('sha512', secretDecoded);
        return hmac.update(hash).digest('base64');
    }

    async request(method, endpoint, params = {}) {
        const url = this.baseUrl + endpoint;
        const nonce = this.createNonce();
        let postData = '';
        let headers = {
            'APIKey': this.apiKey,
            'Nonce': nonce
        };

        // Determine postData and Content-Type based on method
        if (method === 'POST') {
            postData = qs.stringify(params);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else { // GET
            // As confirmed by your working code, Content-Type is included for GET
            headers['Content-Type'] = 'application/json';
            // For GET requests, the signature uses an empty string for postData
        }
        
        // The signature is created with the correct postData string (empty for GET, encoded for POST)
        headers['Authent'] = this.signRequest(endpoint, nonce, postData);

        const requestConfig = { method, url, headers };
        if (method === 'POST') {
            requestConfig.data = postData;
        } else if (Object.keys(params).length > 0) {
            requestConfig.url += '?' + qs.stringify(params);
        }

        try {
            const response = await axios(requestConfig);
            return response.data;
        } catch (error) {
            const errorMessage = error.response ? error.response.data : error.message;
            console.error(`Error with ${method} ${endpoint}:`, JSON.stringify(errorMessage, null, 2));
            throw { endpoint: `${method} ${endpoint}`, error: errorMessage };
        }
    }
    
    // --- Public API Methods ---
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');
    
    // --- Private API Methods ---
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts');
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions');
    sendOrder = (params) => this.request('POST', '/derivatives/api/v3/sendorder', params);
    cancelOrder = (params) => this.request('POST', '/derivatives/api/v3/cancelorder', params);
    // ... add all other API functions here following the same pattern
}

// --- Main Execution ---
async function main() {
    // Replace with your actual, working API credentials
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';
    if (KRAKEN_API_KEY === 'YOUR_API_KEY') {
        console.log("Please add your API credentials to run the example.");
        return;
    }

    const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);

    try {
        console.log("--- Testing GET Request ---");
        const positions = await api.getOpenPositions();
        console.log("getOpenPositions Success! Response:", JSON.stringify(positions, null, 2));

        console.log("\n--- Testing POST Request ---");
        // As you discovered, using a tradeable symbol like 'pf_xbtusd' is the key.
        const orderParams = {
            orderType: 'lmt',
            symbol: 'pf_xbtusd', // Using the correct, tradeable symbol
            side: 'buy',
            size: 1,
            limitPrice: 1000.0
        };
        const orderResult = await api.sendOrder(orderParams);
        console.log("sendOrder Success! Response:", JSON.stringify(orderResult, null, 2));

    } catch (e) {
        console.log("\nExecution halted due to an error.");
    }
}

main();
le.error("FATAL: Please replace 'YOUR_KRAKEN_API_KEY' and 'YOUR_KRAKEN_API_SECRET' in the script.");
        return;
    }

    const bot = new TradingBot(KRAKEN_API_KEY, KRAKEN_API_SECRET, TRADEABLE_SYMBOL, DECISION_INTERVAL_MS);
    bot.start();
}

main();

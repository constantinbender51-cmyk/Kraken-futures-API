const crypto = require('crypto');
const axios =require('axios');
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

        // Determine postData and Content-Type based on the request method
        if (method === 'POST') {
            postData = qs.stringify(params);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else { // GET
            // For GET requests, the signature uses an empty string for postData.
            // The Content-Type header is included as confirmed by your working tests.
            headers['Content-Type'] = 'application/json';
        }
        
        // The signature is created with the correct postData string (empty for GET, URL-encoded for POST)
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
    
    // --- Public API Methods (Example) ---
    // Public methods don't need signing, so they could use a simpler, separate request function if desired.
    // For simplicity here, we can just use the main request method which will ignore the signing logic for them.
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');
    
    // --- Private API Methods ---
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts');
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions');
    sendOrder = (params) => this.request('POST', '/derivatives/api/v3/sendorder', params);
    cancelOrder = (params) => this.request('POST', '/derivatives/api/v3/cancelorder', params);
    // ...and so on for all other API functions.
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
        console.log("--- Testing GET Request: getOpenPositions ---");
        const positions = await api.getOpenPositions();
        console.log("Success! Response:", JSON.stringify(positions, null, 2));

        console.log("\n--- Testing POST Request: sendOrder ---");
        const orderParams = {
            orderType: 'lmt',
            symbol: 'pf_xbtusd', // Using a confirmed tradeable symbol
            side: 'buy',
            size: 1,
            limitPrice: 1000.0 // Example price
        };
        const orderResult = await api.sendOrder(orderParams);
        console.log("Success! Response:", JSON.stringify(orderResult, null, 2));

    } catch (e) {
        console.log("\nExecution halted due to a caught error.");
    }
}

main();

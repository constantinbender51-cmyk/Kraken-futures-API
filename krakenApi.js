const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

// #############################
// ## DeepSeek API Caller ##
// #############################
// Configuration
const DEEPSEEK_API_KEY = 'sk-ae85860567f8462b95e774393dfb5dc3'; // <-- IMPORTANT: Replace with your key
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function callDeepSeekAPI(prompt) {
    if (DEEPSEEK_API_KEY === 'YOUR_DEEPSEEK_API_KEY') {
        console.error("FATAL: DeepSeek API key is not set.");
        // Return a "doNothing" command to prevent crashes in a live loop.
        return JSON.stringify({ function: "doNothing", parameters: { reason: "AI not configured" } });
    }
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5, // Lower temperature for more deterministic, safer trading decisions
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        // Extracting only the JSON part, assuming the AI returns it in a code block or similar
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
        if (jsonMatch) {
            return jsonMatch[1] || jsonMatch[2];
        }
        return content; // Fallback to returning the raw content
    } catch (error) {
        console.error('Error calling DeepSeek API:', error);
        return null;
    }
}


// #############################
// ## Kraken Futures API Class ##
// #############################
class KrakenFuturesApi {
    // ... (The full class from your original code goes here) ...
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
    async request(method, endpoint, params = {}, isPrivate = false) {
        const url = this.baseUrl + endpoint;
        const requestConfig = { method, url };
        if (isPrivate) {
            const nonce = this.createNonce();
            let postData = '';
            const headers = { 'APIKey': this.apiKey, 'Nonce': nonce };
            if (method === 'POST') {
                postData = qs.stringify(params);
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                requestConfig.data = postData;
            } else {
                headers['Content-Type'] = 'application/json';
                if (Object.keys(params).length > 0) {
                    requestConfig.url += '?' + qs.stringify(params);
                }
            }
            headers['Authent'] = this.signRequest(endpoint, nonce, postData);
            requestConfig.headers = headers;
        } else {
            if (Object.keys(params).length > 0) {
                requestConfig.url += '?' + qs.stringify(params);
            }
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
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');
    getOrderbook = (symbol) => this.request('GET', '/derivatives/api/v3/orderbook', { symbol });
    getHistory = (symbol, lastTime) => this.request('GET', '/derivatives/api/v3/history', { symbol, lastTime });
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts', {}, true);
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions', {}, true);
    getOpenOrders = () => this.request('GET', '/derivatives/api/v3/openorders', {}, true);
    getRecentOrders = (symbol) => this.request('GET', '/derivatives/api/v3/recentorders', { symbol }, true);
    getFills = (lastFillTime) => this.request('GET', '/derivatives/api/v3/fills', { lastFillTime }, true);
    getAccountLog = () => this.request('GET', '/api/history/v2/account-log', {}, true);
    sendOrder = (orderParams) => this.request('POST', '/derivatives/api/v3/sendorder', orderParams, true);
    editOrder = (editParams) => this.request('POST', '/derivatives/api/v3/editorder', editParams, true);
    cancelOrder = (cancelParams) => this.request('POST', '/derivatives/api/v3/cancelorder', cancelParams, true);
    cancelAllOrders = (symbol) => this.request('POST', '/derivatives/api/v3/cancelallorders', { symbol }, true);
    cancelAllOrdersAfter = (timeoutSeconds) => this.request('POST', '/derivatives/api/v3/cancelallordersafter', { timeout: timeoutSeconds }, true);
    batchOrder = (batchJson) => this.request('POST', '/derivatives/api/v3/batchorder', { json: JSON.stringify(batchJson) }, true);
    getTransfers = (lastTransferTime) => this.request('GET', '/derivatives/api/v3/transfers', { lastTransferTime }, true);
    getNotifications = () => this.request('GET', '/derivatives/api/v3/notifications', {}, true);
}


// #############################
// ## The Main Trading Loop ##
// #############################

class TradingBot {
    constructor(apiKey, apiSecret, symbol, interval = 30000) {
        this.api = new KrakenFuturesApi(apiKey, apiSecret);
        this.symbol = symbol;
        this.interval = interval; // Time in ms between decisions
        this.conversationHistory = []; // Stores the AI's decisions and results
        this.isRunning = false;
    }

    // Helper to format the conversation history for the prompt
    formatHistory() {
        if (this.conversationHistory.length === 0) {
            return "This is the first decision in the session.";
        }
        return this.conversationHistory.map(turn =>
            `AI Command: ${JSON.stringify(turn.command)}\nExecution Result: ${JSON.stringify(turn.result)}`
        ).join('\n\n');
    }

    // The main prompt sent to the AI
    constructPrompt(marketData) {
        return `
You are an expert crypto trading AI. Your primary objective is to strategically manage a futures trading portfolio on Kraken Futures to maximize its growth.

You will be given the complete conversation history from this session, including your previous commands and their execution results. You will also receive fresh, real-time market data.

Analyze all this information and decide on the single best action to take right now. Return your decision as a single, clean JSON object with no other text or explanation.

<AVAILABLE_ACTIONS>
- sendOrder: { "orderType": "lmt" | "mkt", "symbol": "${this.symbol}", "side": "buy" | "sell", "size": integer, "limitPrice": float }
- editOrder: { "orderId": "string", "size": integer, "limitPrice": float }
- cancelOrder: { "order_id": "string" }
- cancelAllOrders: { "symbol": "${this.symbol}" }
- doNothing: { "reason": "string" } // Use this if no action is warranted.
</AVAILABLE_ACTIONS>

---
**SESSION HISTORY (Your Previous Actions and Their Results):**
${this.formatHistory()}

---
**CURRENT MARKET AND ACCOUNT DATA (as of ${new Date().toISOString()}):**

1. Account Balances:
   ${JSON.stringify(marketData.accounts)}

2. Current Open Positions:
   ${JSON.stringify(marketData.openPositions)}

3. Current Open Orders:
   ${JSON.stringify(marketData.openOrders)}

4. Market Data for Symbol (${this.symbol}):
   - Ticker: ${JSON.stringify(marketData.ticker)}
   - Order Book (Top 5 Levels): ${JSON.stringify(marketData.orderBook)}
   - Recent Trades (Last 10): ${JSON.stringify(marketData.history)}

---
**YOUR TASK:**

Based on the session history and the latest data, what is the next logical action? Return your command as a JSON object.
`;
    }
// Replace the entire runDecisionCycle method in your TradingBot class with this one.

async runDecisionCycle() {
    console.log(`\n--- [${new Date().toLocaleTimeString()}] Starting new decision cycle ---`);

    // 1. Gather all necessary data with individual error handling
    console.log("Fetching latest market and account data...");
    const [
        accounts,
        openPositions,
        openOrders,
        tickers,
        orderBookData,
        historyData
    ] = await Promise.all([
        this.api.getAccounts().catch(e => { console.error("Error fetching accounts:", e); return null; }),
        this.api.getOpenPositions().catch(e => { console.error("Error fetching open positions:", e); return null; }),
        this.api.getOpenOrders().catch(e => { console.error("Error fetching open orders:", e); return null; }),
        this.api.getTickers().catch(e => { console.error("Error fetching tickers:", e); return null; }),
        this.api.getOrderbook(this.symbol).catch(e => { console.error(`Error fetching order book for ${this.symbol}:`, e); return null; }),
        this.api.getHistory(this.symbol).catch(e => { console.error(`Error fetching history for ${this.symbol}:`, e); return null; })
    ]);

    // Critical data check: If we don't have account info, we can't proceed.
    if (!accounts) {
        console.error("Could not fetch essential account data. Skipping this cycle.");
        return;
    }

    // 2. Safely construct the marketData object
    const marketData = {
        accounts,
        openPositions: openPositions || { openPositions: [] }, // Provide a default empty structure
        openOrders: openOrders || { orders: [] },             // Provide a default empty structure
        ticker: tickers?.tickers?.find(t => t.symbol === this.symbol) || null, // Use optional chaining
        orderBook: (orderBookData?.bids && orderBookData?.asks)
            ? {
                bids: orderBookData.bids.slice(0, 5),
                asks: orderBookData.asks.slice(0, 5)
              }
            : null, // If orderBookData is null or malformed, send null to the AI
        history: historyData?.history?.slice(0, 10) || null // Use optional chaining and provide null fallback
    };

    // 3. Construct the prompt and get AI decision
    console.log("Constructing prompt and querying AI...");
    const prompt = this.constructPrompt(marketData);
    const aiResponseString = await callDeepSeekAPI(prompt);

    if (!aiResponseString) {
        console.error("Failed to get a response from AI. Skipping cycle.");
        return;
    }

    // 4. Parse and execute the decision (This part remains the same)
    let decision;
    try {
        decision = JSON.parse(aiResponseString);
    } catch (e) {
        console.error("Failed to parse AI response into JSON. Response was:", aiResponseString);
        this.conversationHistory.push({
            command: { function: "parseError", parameters: {} },
            result: { error: "Invalid JSON response from AI.", response: aiResponseString }
        });
        return;
    }

    console.log(`AI Decision: ${decision.function}`, decision.parameters || '');

    let executionResult;
    try {
        switch (decision.function) {
            case "sendOrder":
                executionResult = await this.api.sendOrder(decision.parameters);
                break;
            case "editOrder":
                executionResult = await this.api.editOrder(decision.parameters);
                break;
            case "cancelOrder":
                executionResult = await this.api.cancelOrder(decision.parameters);
                break;
            case "cancelAllOrders":
                executionResult = await this.api.cancelAllOrders(decision.parameters.symbol);
                break;
            case "doNothing":
                executionResult = { status: "success", reason: decision.parameters.reason };
                break;
            default:
                throw new Error(`Unknown function '${decision.function}' received from AI.`);
        }
        console.log("Execution Result:", executionResult);
    } catch (error) {
        console.error("Error executing AI command:", error);
        executionResult = { status: "error", details: error };
    }

    // 5. Update conversation history
    this.conversationHistory.push({ command: decision, result: executionResult });
}


// #############################
// ##      RUN THE BOT        ##
// #############################

function main() {
    // --- CONFIGURATION ---
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';    const TRADEABLE_SYMBOL = 'pf_xbtusd'; // The symbol you want the bot to trade
    const DECISION_INTERVAL_MS = 30000; // 30 seconds

    if (KRAKEN_API_KEY === 'YOUR_KRAKEN_API_KEY' || KRAKEN_API_SECRET === 'YOUR_KRAKEN_API_SECRET') {
        console.error("FATAL: Please replace 'YOUR_KRAKEN_API_KEY' and 'YOUR_KRAKEN_API_SECRET' in the script.");
        return;
    }

    const bot = new TradingBot(KRAKEN_API_KEY, KRAKEN_API_SECRET, TRADEABLE_SYMBOL, DECISION_INTERVAL_MS);
    bot.start();
}

main();

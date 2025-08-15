# WhatsApp AliExpress Bot (Group)

Bot for WhatsApp groups using `whatsapp-web.js`. Trigger in Hebrew:
```
תחפש לי את ה <שם המוצר>
```
Returns **3 products** from AliExpress with **image, short marketing text, rating, price and affiliate link**.

## Quick Start (local)
1. Install Node 18+
2. `npm install`
3. Copy `.env.example` to `.env` and fill AliExpress keys. If you leave them empty, the bot will work in MOCK mode.
4. `node bot.js`
5. Scan the QR in your terminal with the phone that will serve as the bot.
6. Add the bot's number to your group and try:
   ```
   תחפש לי את ה מברשת שיניים חשמלית
   ```

## Deploy on Render
- Start Command: `node bot.js`
- Add a **Disk** mounted at `/app/.wwebjs_auth` so the QR session persists.
- Set environment variables from `.env.example` in Render's dashboard.
- Ensure Puppeteer flags are present: `--no-sandbox --disable-setuid-sandbox` (already in `bot.js`).

## Notes
- The code includes a MOCK search so you can test end-to-end before enabling the real AliExpress API.
- For real API usage, adapt `searchAliExpressReal()` and `toAffiliateLink()` to your AliExpress Open Platform endpoints and signing method.

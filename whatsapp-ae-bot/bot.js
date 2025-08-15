// bot.js
require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ===== Settings =====
const COUNTRY  = process.env.COUNTRY  || 'IL';
const CURRENCY = process.env.CURRENCY || 'ILS';
const LANG     = process.env.LANG     || 'HE';

// Use mock data if no AliExpress keys are provided
const USE_MOCK = !process.env.AE_APP_KEY;

// ===== Helpers =====
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function marketingCopy(title) {
  return `✨ ${title}\n✅ איכות מעולה במחיר משתלם\n🚚 משלוח לישראל | קנייה בטוחה`;
}

function productCaption(p) {
  const lines = [
    `🛒 ${p.title}`,
    marketingCopy(p.title),
    ``,
    `⭐ דירוג: ${p.rating ?? 'N/A'}`,
    `💰 מחיר: ${p.price ?? 'בדוק בקישור'}`,
    `🔗 קישור: ${p.affiliateUrl || p.url}`
  ];
  return lines.join('\n');
}

// ===== AliExpress search (MOCK & REAL) =====
async function searchAliExpressMock(keyword) {
  return [
    {
      title: `${keyword} דגם A`,
      image: 'https://via.placeholder.com/800x800.png?text=' + encodeURIComponent(keyword + ' A'),
      rating: 4.7,
      price: '₪59.90',
      url: 'https://aliexpress.com/item/EXAMPLE_A'
    },
    {
      title: `${keyword} דגם B`,
      image: 'https://via.placeholder.com/800x800.png?text=' + encodeURIComponent(keyword + ' B'),
      rating: 4.8,
      price: '₪74.50',
      url: 'https://aliexpress.com/item/EXAMPLE_B'
    },
    {
      title: `${keyword} דגם C`,
      image: 'https://via.placeholder.com/800x800.png?text=' + encodeURIComponent(keyword + ' C'),
      rating: 4.6,
      price: '₪88.00',
      url: 'https://aliexpress.com/item/EXAMPLE_C'
    }
  ];
}

async function searchAliExpressReal(keyword) {
  const base = process.env.AE_API_BASE;
  if (!base) throw new Error('AE_API_BASE is not set');

  const params = {
    method: 'aliexpress.affiliate.product.query',
    app_key: process.env.AE_APP_KEY,
    keywords: keyword,
    page_no: 1,
    page_size: 20,
    target_currency: CURRENCY,
    target_language: LANG,
    country: COUNTRY,
    // Depending on your Open Platform account, you may need "timestamp", "sign", "sign_method", etc.
  };

  // NOTE: Some accounts require signed requests or POST requests. Adjust accordingly.
  const { data } = await axios.get(base, { params });

  // Map response -> 3 items (Adjust paths to your API response shape)
  const rawList =
    data?.response?.result?.result_list ||
    data?.resp?.result?.result_list ||
    [];

  const items = rawList.slice(0, 3).map(p => ({
    title: p.productTitle || p.title,
    image: p.productMainImageUrl || p.imageUrl,
    rating: p.evaluateRate || p.averageRating,
    price: (p.appSalePrice && p.appSalePriceCurrency)
      ? `${p.appSalePrice} ${p.appSalePriceCurrency}`
      : (p.salePrice && p.salePriceCurrency ? `${p.salePrice} ${p.salePriceCurrency}` : p.price),
    url: p.productDetailUrl || p.detailUrl
  }));

  return items;
}

async function toAffiliateLink(productUrl) {
  const base = process.env.AE_API_BASE;
  if (!base) return productUrl;

  try {
    const params = {
      method: 'aliexpress.affiliate.link.generate',
      app_key: process.env.AE_APP_KEY,
      source_values: productUrl,
      // Some integrations require pid/tracking id:
      // pid: process.env.AE_TRACKING_ID
    };
    const { data } = await axios.get(base, { params });
    const link =
      data?.response?.result?.promotion_links?.[0]?.promotion_link ||
      data?.resp?.result?.promotion_links?.[0]?.promotion_link;
    return link || productUrl;
  } catch (e) {
    return productUrl;
  }
}

// ===== WhatsApp client (group-friendly) =====
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ הבוט עלה ועובד'));

client.on('message', async (msg) => {
  const text = (msg.body || '').trim();

  // Hebrew trigger variations
  const m =
    text.match(/^תחפש(?:\s+לי)?\s+את\s+ה(.+)/) ||
    text.match(/^תחפש(?:\s+לי)?\s+(.+)/);

  if (!m) return;

  const keyword = m[1].trim();
  await msg.reply(`🔎 מחפש לך באליאקספרס: “${keyword}”...`);

  try {
    const products = USE_MOCK
      ? await searchAliExpressMock(keyword)
      : await searchAliExpressReal(keyword);

    const top3 = products.slice(0, 3);

    for (const p of top3) {
      const affiliateUrl = await toAffiliateLink(p.url);

      if (p.image) {
        try {
          const media = await MessageMedia.fromUrl(p.image);
          await client.sendMessage(msg.from, media);
          await sleep(300);
        } catch {}
      }

      const caption = productCaption({ ...p, affiliateUrl });
      await client.sendMessage(msg.from, caption);
      await sleep(500);
    }
  } catch (err) {
    console.error(err);
    await msg.reply('❌ לא הצלחתי להביא תוצאות כרגע. נסה שוב עוד מעט.');
  }
});

client.initialize();

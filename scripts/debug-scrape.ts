import * as cheerio from "cheerio"

const url = 'https://www.formula1.com/en/results/2025/races';

const scrape = async () => {
    try {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const rows = $('tr').map((i, el) => $(el).text().trim().replace(/\s+/g, ' ')).get();
        console.log("Found rows:", rows.slice(0, 10));

        const text = $('body').text().replace(/\s+/g, ' ').trim();

        console.log("--- START OF CONTENT ---");
        console.log(text.substring(0, 500)); // Print first 500 chars
        console.log("...");
        console.log(text.substring(text.length - 500)); // Print last 500 chars
        console.log("--- END OF CONTENT ---");

        // Search for a known driver or team to see if data exists
        const hasNorris = text.includes("Norris");
        const hasMcLaren = text.includes("McLaren");
        console.log(`Contains 'Norris': ${hasNorris}`);
        console.log(`Contains 'McLaren': ${hasMcLaren}`);

    } catch (e) {
        console.error(e);
    }
}

scrape();

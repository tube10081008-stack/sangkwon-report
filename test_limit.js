
import 'dotenv/config';

async function testApi() {
    const STORE_API_KEY = process.env.STORE_API_KEY;

    try {
        // Gangnam station coordinates
        const url = `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${STORE_API_KEY}&pageNo=1&numOfRows=1000&radius=1000&cx=127.027&cy=37.497&type=json`;
        const r = await fetch(url);
        const data = await r.json();
        
        console.log("totalCount Gangnam:", data.body.totalCount);
        console.log("items array length:", Array.isArray(data.body.items) ? data.body.items.length : 'not array');

    } catch (e) {
        console.log("Error:", e.message);
    }
}
testApi();

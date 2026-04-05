
import 'dotenv/config';

async function testApi() {
    const STORE_API_KEY = process.env.STORE_API_KEY;
    console.log("Key exists:", !!STORE_API_KEY);

    try {
        const url = `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${STORE_API_KEY}&pageNo=1&numOfRows=1000&radius=500&cx=126.917&cy=37.608&type=json`;
        const r = await fetch(url);
        const data = await r.json();
        
        console.log("totalCount:", data.body.totalCount);
        console.log("items typeof:", typeof data.body.items);
        console.log("isArray?", Array.isArray(data.body.items));
        if (data.body.items) {
             console.log("isArray items?", Array.isArray(data.body.items));
        }

        const url2 = `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${STORE_API_KEY}&pageNo=2&numOfRows=1000&radius=500&cx=126.917&cy=37.608&type=json`;
        const r2 = await fetch(url2);
        const data2 = await r2.json();
        console.log("page2 items length?:", data2.body.items?.length);
    } catch (e) {
        console.log(e);
    }
}
testApi();

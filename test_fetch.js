const apiKey = "AIzaSyAztcRalUrMmfXpKBecPfLCExuFa5xfFqE";

async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Hello" }] }]
    })
  });
  const data = await response.json();
  console.log(response.status);
  console.log(JSON.stringify(data, null, 2));
}

test();

import fs from 'fs';

const apiKey = "AIzaSyAztcRalUrMmfXpKBecPfLCExuFa5xfFqE";

async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    console.log("ERROR:", data.error.message);
  } else {
    fs.writeFileSync('models.txt', data.models.map(m => m.name).join("\n"));
    console.log("Wrote to models.txt");
  }
}

test();

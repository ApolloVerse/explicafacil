const fs = require('fs');
const pdf = require('pdf-parse');

const files = fs.readdirSync(__dirname);
const pdfFile = files.find(f => f.endsWith('.pdf'));

if (pdfFile) {
    let dataBuffer = fs.readFileSync(pdfFile);
    pdf(dataBuffer).then(function(data) {
        console.log(data.text);
    }).catch(err => {
        console.error("PDF Parse Error:", err);
    });
} else {
    console.log("No PDF found");
}

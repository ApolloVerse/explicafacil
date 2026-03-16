import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const files = fs.readdirSync(process.cwd());
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

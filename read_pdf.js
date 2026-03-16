const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('Prompt_de_Refatoração_e_Segurança_para_o_App_ExplicaFácil.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(console.error);

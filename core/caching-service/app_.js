const crypto = require('crypto');

const stringHash =  JSON.stringify({bla:'bla'});

const cipher = crypto.createCipher('aes192', 'a password');
let encrypted = cipher.update(stringHash, 'utf8', 'base64');
encrypted += cipher.final('base64');
console.log(encrypted);


const decipher = crypto.createDecipher('aes192', 'a password');
let decrypted = decipher.update(encrypted, 'base64', 'utf8');
decrypted += decipher.final('utf8');
console.log(decrypted);
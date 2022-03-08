const crypto = require('crypto');

module.exports = {
    foo: crypto.createHash('md5').update('bar').digest('hex')
};

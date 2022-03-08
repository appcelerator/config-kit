import crypto from 'crypto';

export default {
    foo: crypto.createHash('md5').update('bar').digest('hex')
};

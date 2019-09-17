"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Serialize = require('php-serialize');
const crypto = require('crypto');
class LaravelEncryptor {
    constructor(options) {
        this.options = options;
        this.key_length = 64;
        this.valid_key_lengths = [32, 64];
        if (this.options.laravel_key)
            console.log('Laravel Encryptor, laravel_key is depreciated, please use key instead');
        const key = this.options.laravel_key ? this.options.laravel_key : this.options.key;
        this.errors = [];
        this.setAlgorithm();
        this.secret = Buffer.from(key, 'base64');
    }
    setAlgorithm() {
        if (this.options.key_length && this.valid_key_lengths.indexOf(this.options.key_length) < 0)
            this.errors.push(new Error('The only supported ciphers are AES-128-CBC and AES-256-CBC with the correct key lengths.'));
        this.algorithm = this.options.key_length ?
            `aes-${this.options.key_length * 4}-cbc` : `aes-${this.key_length * 4}-cbc`;
    }
    encrypt(data, serialize) {
        if (this.is_there_any_errors())
            return Promise.reject(this.returnError());
        serialize = (serialize !== undefined) ? serialize : true;
        const payload = serialize ? LaravelEncryptor.serialize(data) : data;
        return this
            .encryptIt(payload)
            .then(LaravelEncryptor.stringifyAndBase64, LaravelEncryptor.throwError);
    }
    encryptIt(data) {
        return this
            .generate_iv()
            .then(this.createCypherIv())
            .then(this.cipherIt(data))
            .then(this.generateEncryptedObject());
    }
    createCypherIv() {
        return (iv) => {
            try {
                return { iv, cipher: crypto.createCipheriv(this.algorithm, this.secret, iv) };
            }
            catch (e) {
                throw e;
            }
        };
    }
    cipherIt(data) {
        return ({ iv, cipher }) => {
            return {
                iv,
                value: cipher.update(data, 'utf8', 'base64') + cipher.final('base64')
            };
        };
    }
    generateEncryptedObject() {
        return ({ iv, value }) => {
            iv = LaravelEncryptor.toBase64(iv);
            return {
                iv,
                value,
                mac: this.hashIt(iv, value)
            };
        };
    }
    decrypt(data, serialize) {
        if (this.is_there_any_errors())
            return Promise.reject(this.returnError());
        return this.decryptIt(data, serialize);
    }
    decryptIt(payload, serialize) {
        serialize = (serialize !== undefined) ? serialize : true;
        payload = LaravelEncryptor.base64ToUtf8(payload);
        try {
            payload = JSON.parse(payload);
        }
        catch (e) {
            return Promise.reject(e);
        }
        return this
            .createDecipheriv(payload.iv)
            .then(this.cryptoDecipher(payload))
            .then(this.ifSerialized_unserialize(serialize), LaravelEncryptor.throwError);
    }
    createDecipheriv(iv) {
        return new Promise((resolve, reject) => {
            try {
                const deCipher = crypto.createDecipheriv(this.algorithm, this.secret, Buffer.from(iv, 'base64'));
                resolve(deCipher);
            }
            catch (e) {
                reject(e);
            }
        });
    }
    cryptoDecipher(payload) {
        return (deCipher) => {
            return deCipher.update(payload.value, 'base64', 'utf8') + deCipher.final('utf8');
        };
    }
    ifSerialized_unserialize(serialize) {
        return (decrypted) => {
            return serialize ? LaravelEncryptor.unSerialize(decrypted) : decrypted;
        };
    }
    generate_iv() {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(8, (err, buffer) => {
                if (err)
                    return reject(err);
                resolve(buffer.toString('hex'));
            });
        });
    }
    static serialize(data) {
        return Serialize.serialize(data);
    }
    static unSerialize(data) {
        return Serialize.unserialize(data);
    }
    static toBase64(data) {
        return Buffer.from(data).toString('base64');
    }
    static base64ToUtf8(data) {
        return Buffer.from(data, 'base64').toString('utf8');
    }
    hashIt(iv, encrypted) {
        const hmac = LaravelEncryptor.createHmac("sha256", this.secret);
        return hmac
            .update(LaravelEncryptor.setHmacPayload(iv, encrypted))
            .digest("hex");
    }
    static createHmac(alg, secret) {
        return crypto.createHmac(alg, secret);
    }
    static setHmacPayload(iv, encrypted) {
        return Buffer.from(iv + encrypted, 'utf-8');
    }
    is_there_any_errors() {
        return this.errors.length >= 1;
    }
    returnError() {
        return this.errors[0];
    }
    static stringifyAndBase64(encrypted) {
        encrypted = JSON.stringify(encrypted);
        return Buffer.from(encrypted).toString('base64');
    }
    static throwError(error) {
        throw error;
    }
    static generateRandomKey(length) {
        return new Promise((resolve, reject) => {
            length = length ? length : 32;
            crypto.randomBytes(length, (err, buffer) => {
                if (err)
                    return reject(err);
                resolve(buffer.toString('base64'));
            });
        });
    }
}
exports.LaravelEncryptor = LaravelEncryptor;
